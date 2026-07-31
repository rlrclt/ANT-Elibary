"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  enqueueLineNotification,
  sendQueuedLineNotification,
} from "@/utils/line-notify";

/**
 * Server Actions สำหรับ /member/loans (ระบบยืม-คืนสำหรับสมาชิก)
 * ใช้ session ของสมาชิกที่ล็อกอินอยู่ ไม่ต้องส่ง user_id มาจาก client
 * จัดการ borrow_records, book_copies, users (fine_balance), fine_payments
 *
 * การแจ้งเตือน LINE: ใช้ after() + Notification Queue (เหมือนฝั่ง staff)
 */

// อัตราค่าปรับต่อวัน (บาท) — ค่าปรับกรณีคืนเกินกำหนด
const FINE_PER_DAY = 5;

// ระยะเวลายืมเริ่มต้น (วัน)
const DEFAULT_BORROW_DAYS = 14;

// จำนวนวันต่ออายุครั้งละ
const EXTENSION_DAYS = 7;

// จำนวนครั้งต่ออายุสูงสุด
const MAX_EXTENSION = 1;

// ---------- Types ----------
export type MemberBorrowRecord = {
  id: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: "borrowing" | "returned" | "overdue" | "lost";
  fine_amount: number;
  fine_reason: string | null;
  remark: string | null;
  extension_count: number;
  book_copy: {
    barcode: string;
    condition: string | null;
    book: {
      id: string;
      title: string;
      author: string | null;
      book_code: string;
      cover_image_url: string | null;
      shelf_location: string | null;
      book_categories: {
        name: string;
        color_code: string | null;
      } | null;
    } | null;
  } | null;
};

export type MemberFineSummary = {
  totalUnpaid: number;
  unpaidCount: number;
  paidCount: number;
};

type ActionResult<T> = { data: T | null; error: string | null };

// ---------- 1. getMyBorrowsAction ----------
/**
 * ดึงประวัติยืมทั้งหมดของสมาชิกที่ล็อกอินอยู่ (รวมที่คืนแล้ว)
 * เรียงตามวันที่ยืม ล่าสุดก่อน
 */
export async function getMyBorrowsAction(): Promise<ActionResult<MemberBorrowRecord[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "กรุณาเข้าสู่ระบบ" };

  const { data, error } = await supabase
    .from("borrow_records")
    .select(
      `
      id, borrowed_at, due_date, returned_at, status, fine_amount,
      fine_reason, remark, extension_count,
      book_copies!borrow_records_book_copy_id_fkey (
        barcode, condition,
        books!book_copies_book_id_fkey (
          id, title, author, book_code, cover_image_url, shelf_location,
          book_categories ( name, color_code )
        )
      )
      `,
    )
    .eq("user_id", user.id)
    .order("borrowed_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const records: MemberBorrowRecord[] = (data ?? []).map((r: any) => ({
    id: r.id,
    borrowed_at: r.borrowed_at,
    due_date: r.due_date,
    returned_at: r.returned_at,
    status: r.status,
    fine_amount: Number(r.fine_amount ?? 0),
    fine_reason: r.fine_reason ?? null,
    remark: r.remark ?? null,
    extension_count: r.extension_count ?? 0,
    book_copy: r.book_copies
      ? {
          barcode: r.book_copies.barcode,
          condition: r.book_copies.condition,
          book: r.book_copies.books
            ? {
                id: r.book_copies.books.id,
                title: r.book_copies.books.title,
                author: r.book_copies.books.author ?? null,
                book_code: r.book_copies.books.book_code,
                cover_image_url: r.book_copies.books.cover_image_url ?? null,
                shelf_location: r.book_copies.books.shelf_location ?? null,
                book_categories: r.book_copies.books.book_categories
                  ? {
                      name: r.book_copies.books.book_categories.name,
                      color_code:
                        r.book_copies.books.book_categories.color_code ?? null,
                    }
                  : null,
              }
            : null,
        }
      : null,
  }));

  return { data: records, error: null };
}

// ---------- 2. getMyActiveBorrowsAction ----------
/**
 * ดึงรายการยืมที่ยังไม่ได้คืนของสมาชิก (returned_at IS NULL)
 */
export async function getMyActiveBorrowsAction(): Promise<
  ActionResult<MemberBorrowRecord[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "กรุณาเข้าสู่ระบบ" };

  const { data, error } = await supabase
    .from("borrow_records")
    .select(
      `
      id, borrowed_at, due_date, returned_at, status, fine_amount,
      fine_reason, remark, extension_count,
      book_copies!borrow_records_book_copy_id_fkey (
        barcode, condition,
        books!book_copies_book_id_fkey (
          id, title, author, book_code, cover_image_url, shelf_location,
          book_categories ( name, color_code )
        )
      )
      `,
    )
    .eq("user_id", user.id)
    .is("returned_at", null)
    .order("borrowed_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const records: MemberBorrowRecord[] = (data ?? []).map((r: any) => ({
    id: r.id,
    borrowed_at: r.borrowed_at,
    due_date: r.due_date,
    returned_at: r.returned_at,
    status: r.status,
    fine_amount: Number(r.fine_amount ?? 0),
    fine_reason: r.fine_reason ?? null,
    remark: r.remark ?? null,
    extension_count: r.extension_count ?? 0,
    book_copy: r.book_copies
      ? {
          barcode: r.book_copies.barcode,
          condition: r.book_copies.condition,
          book: r.book_copies.books
            ? {
                id: r.book_copies.books.id,
                title: r.book_copies.books.title,
                author: r.book_copies.books.author ?? null,
                book_code: r.book_copies.books.book_code,
                cover_image_url: r.book_copies.books.cover_image_url ?? null,
                shelf_location: r.book_copies.books.shelf_location ?? null,
                book_categories: r.book_copies.books.book_categories
                  ? {
                      name: r.book_copies.books.book_categories.name,
                      color_code:
                        r.book_copies.books.book_categories.color_code ?? null,
                    }
                  : null,
              }
            : null,
        }
      : null,
  }));

  return { data: records, error: null };
}

// ---------- 3. getMyFineSummaryAction ----------
/**
 * สรุปค่าปรับของสมาชิก:
 * - totalUnpaid: รวมค่าปรับที่ยังไม่ได้ชำระ (fine_amount > 0 และไม่มี fine_payment status='approved')
 * - unpaidCount: จำนวนรายการที่ยังไม่ได้ชำระ
 * - paidCount: จำนวนรายการที่ชำระแล้ว (มี fine_payment status='approved')
 */
export async function getMyFineSummaryAction(): Promise<{
  data: MemberFineSummary;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      data: { totalUnpaid: 0, unpaidCount: 0, paidCount: 0 },
      error: "กรุณาเข้าสู่ระบบ",
    };

  // ดึงรายการยืมที่มีค่าปรับ > 0 และ status='returned'
  const { data: finedRecords, error } = await supabase
    .from("borrow_records")
    .select("id, fine_amount")
    .eq("user_id", user.id)
    .eq("status", "returned")
    .gt("fine_amount", 0);

  if (error)
    return {
      data: { totalUnpaid: 0, unpaidCount: 0, paidCount: 0 },
      error: error.message,
    };

  const recordIds = (finedRecords ?? []).map((r: any) => r.id);

  if (recordIds.length === 0) {
    return {
      data: { totalUnpaid: 0, unpaidCount: 0, paidCount: 0 },
      error: null,
    };
  }

  // ดึง fine_payments ที่ status='approved' ของรายการเหล่านี้
  const { data: approvedPayments } = await supabase
    .from("fine_payments")
    .select("borrow_record_id, status")
    .in("borrow_record_id", recordIds)
    .eq("status", "approved");

  const approvedSet = new Set(
    (approvedPayments ?? []).map((p: any) => p.borrow_record_id),
  );

  let totalUnpaid = 0;
  let unpaidCount = 0;
  let paidCount = 0;

  for (const record of finedRecords ?? []) {
    if (approvedSet.has((record as any).id)) {
      paidCount++;
    } else {
      totalUnpaid += Number((record as any).fine_amount ?? 0);
      unpaidCount++;
    }
  }

  return {
    data: { totalUnpaid, unpaidCount, paidCount },
    error: null,
  };
}

// ---------- 4. memberBorrowAction ----------
/**
 * สมาชิกยืมหนังสือด้วยตนเองผ่านบาร์โค้ด
 * ขั้นตอน:
 * (a) ตรวจสอบผู้ใช้ล็อกอิน
 * (b) หา book_copy ด้วยบาร์โค้ด โดย status ต้องเป็น 'available'
 * (c) ตรวจสถานะสมาชิก='active' และจำนวนยืมปัจจุบัน < borrow_limit
 * (d) INSERT borrow_record: user_id=ผู้ใช้ปัจจุบัน, due_date=now+14วัน, status='borrowing'
 * (e) UPDATE book_copy status='borrowed'
 */
export async function memberBorrowAction(
  formData: FormData,
): Promise<{
  error: string | null;
  recordId: string | null;
  bookTitle: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", recordId: null, bookTitle: null };

  const barcode = String(formData.get("barcode") ?? "").trim();
  if (!barcode)
    return { error: "กรุณากรอกบาร์โค้ด", recordId: null, bookTitle: null };

  // (b) หา book_copy ด้วยบาร์โค้ด WHERE status='available'
  const { data: copy, error: cErr } = await supabase
    .from("book_copies")
    .select(
      `
      id, status,
      books!book_copies_book_id_fkey ( title )
      `,
    )
    .eq("barcode", barcode)
    .maybeSingle();

  if (cErr) return { error: cErr.message, recordId: null, bookTitle: null };
  if (!copy)
    return { error: "ไม่พบเล่มหนังสือที่บาร์โค้ดนี้", recordId: null, bookTitle: null };
  if (copy.status !== "available")
    return {
      error: `เล่มนี้ไม่พร้อมยืม (สถานะปัจจุบัน: ${copy.status})`,
      recordId: null,
      bookTitle: null,
    };

  // (c) ตรวจสถานะสมาชิกและจำนวนยืมปัจจุบัน
  const { data: member, error: mErr } = await supabase
    .from("users")
    .select("id, status, borrow_limit")
    .eq("id", user.id)
    .maybeSingle();

  if (mErr) return { error: mErr.message, recordId: null, bookTitle: null };
  if (!member)
    return { error: "ไม่พบข้อมูลสมาชิก", recordId: null, bookTitle: null };
  if (member.status !== "active")
    return {
      error: "บัญชีไม่อยู่ในสถานะใช้งาน ไม่สามารถยืมได้",
      recordId: null,
      bookTitle: null,
    };

  const { count: currentBorrows } = await supabase
    .from("borrow_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("returned_at", null);

  const limit = member.borrow_limit ?? 5;
  if ((currentBorrows ?? 0) >= limit)
    return {
      error: `คุณยืมครบจำนวนจำกัดแล้ว (${limit} เล่ม)`,
      recordId: null,
      bookTitle: null,
    };

  // (d) คำนวณวันคืน = วันนี้ + 14 วัน
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DEFAULT_BORROW_DAYS);

  const { data: record, error: insertErr } = await supabase
    .from("borrow_records")
    .insert({
      user_id: user.id,
      book_copy_id: copy.id,
      due_date: dueDate.toISOString(),
      status: "borrowing",
    })
    .select("id")
    .single();

  if (insertErr)
    return { error: insertErr.message, recordId: null, bookTitle: null };
  if (!record)
    return {
      error: "ไม่สามารถสร้างรายการยืมได้",
      recordId: null,
      bookTitle: null,
    };

  // (e) UPDATE book_copy status → borrowed
  const { error: updErr } = await supabase
    .from("book_copies")
    .update({ status: "borrowed" })
    .eq("id", copy.id);

  if (updErr) {
    // rollback: ลบ borrow record ที่เพิ่งสร้าง
    await supabase.from("borrow_records").delete().eq("id", record.id);
    return { error: updErr.message, recordId: null, bookTitle: null };
  }

  const bookTitle = (copy as any).books?.title ?? "ไม่ระบุชื่อ";

  // (f) บันทึก Notification Queue + ส่ง LINE แบบ realtime ผ่าน after()
  const { data: memberInfo } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const memberName = (memberInfo as any)?.full_name ?? "-";

  const borrowDateStr = new Date().toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dueDateStr = dueDate.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const queueId = await enqueueLineNotification(user.id, {
    template: "borrow",
    title: "ยืมหนังสือสำเร็จ",
    body: `คุณยืม "${bookTitle}" ครบกำหนดคืน ${dueDateStr}`,
    action_url: "/member/loans",
    icon: "book-open",
    category: "loan",
    member_name: memberName,
    book_title: bookTitle,
    book_copy_no: barcode,
    borrow_date: borrowDateStr,
    due_date: dueDateStr,
  });

  if (queueId) {
    after(() => sendQueuedLineNotification(queueId));
  }

  revalidatePath("/member/loans");
  return { error: null, recordId: record.id, bookTitle };
}

// ---------- 5. memberReturnAction ----------
/**
 * สมาชิกคืนหนังสือด้วยตนเองผ่านบาร์โค้ด
 * คำนวณค่าปรับอัตโนมัติหากคืนเกินกำหนด (5 บาท/วัน)
 */
export async function memberReturnAction(
  formData: FormData,
): Promise<{
  error: string | null;
  fineAmount: number;
  bookTitle: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", fineAmount: 0, bookTitle: null };

  const barcode = String(formData.get("barcode") ?? "").trim();
  const recordId = String(formData.get("record_id") ?? "").trim();

  // กรณีคืนผ่านปุ่มในรายการ (มี record_id มาเลย)
  let targetRecordId = recordId;
  let copyId: string | null = null;
  let bookTitle: string | null = null;

  if (!barcode && !recordId)
    return { error: "กรุณากรอกบาร์โค้ดหรือเลือกรายการ", fineAmount: 0, bookTitle: null };

  if (barcode) {
    // (b) หา book_copy ด้วยบาร์โค้ด
    const { data: copy, error: cErr } = await supabase
      .from("book_copies")
      .select(
        `
        id,
        books!book_copies_book_id_fkey ( title )
        `,
      )
      .eq("barcode", barcode)
      .maybeSingle();

    if (cErr) return { error: cErr.message, fineAmount: 0, bookTitle: null };
    if (!copy)
      return { error: "ไม่พบเล่มหนังสือที่บาร์โค้ดนี้", fineAmount: 0, bookTitle: null };

    copyId = copy.id;
    bookTitle = (copy as any).books?.title ?? "ไม่ระบุชื่อ";

    // (c) หา borrow_record WHERE book_copy_id=copy.id AND user_id=current AND returned_at IS NULL
    const { data: record, error: rErr } = await supabase
      .from("borrow_records")
      .select("id, due_date")
      .eq("book_copy_id", copy.id)
      .eq("user_id", user.id)
      .is("returned_at", null)
      .maybeSingle();

    if (rErr) return { error: rErr.message, fineAmount: 0, bookTitle: null };
    if (!record)
      return {
        error: "ไม่พบรายการยืมของคุณสำหรับเล่มนี้",
        fineAmount: 0,
        bookTitle: null,
      };

    targetRecordId = record.id;
  } else {
    // คืนผ่าน record_id — ดึงข้อมูลเพื่อคำนวณค่าปรับ + หา copy id
    const { data: record, error: rErr } = await supabase
      .from("borrow_records")
      .select(
        `
        id, due_date, book_copy_id,
        book_copies!borrow_records_book_copy_id_fkey (
          barcode,
          books!book_copies_book_id_fkey ( title )
        )
        `,
      )
      .eq("id", recordId)
      .eq("user_id", user.id)
      .is("returned_at", null)
      .maybeSingle();

    if (rErr) return { error: rErr.message, fineAmount: 0, bookTitle: null };
    if (!record)
      return {
        error: "ไม่พบรายการยืม หรือคืนไปแล้ว",
        fineAmount: 0,
        bookTitle: null,
      };

    copyId = record.book_copy_id;
    bookTitle = (record as any).book_copies?.books?.title ?? "ไม่ระบุชื่อ";
  }

  // ดึง due_date ของรายการเพื่อคำนวณค่าปรับ
  const { data: fullRecord, error: frErr } = await supabase
    .from("borrow_records")
    .select("id, due_date, status")
    .eq("id", targetRecordId)
    .maybeSingle();

  if (frErr) return { error: frErr.message, fineAmount: 0, bookTitle: null };
  if (!fullRecord)
    return { error: "ไม่พบรายการยืม", fineAmount: 0, bookTitle: null };

  // (d) คำนวณค่าปรับ: ดึง fine_settings จาก DB
  const now = new Date();
  const due = new Date(fullRecord.due_date);
  const diffMs = now.getTime() - due.getTime();
  const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // ดึง fine_settings (active row เดียว)
  let fineAmount = 0;
  let finalFineReason: string | null = null;

  const { data: fineSettings } = await supabase
    .from("fine_settings")
    .select("overdue_rate, overdue_max_days")
    .eq("is_active", true)
    .maybeSingle();

  if (fineSettings) {
    const overdueRate = Number(fineSettings.overdue_rate ?? 5);
    const maxDays = Number(fineSettings.overdue_max_days ?? 30);

    if (daysOverdue > 0) {
      // ถ้าเกิน max_days → ปรับเท่าราคาเล่ม (ดึงจาก books)
      if (daysOverdue >= maxDays) {
        // ดึงราคาเล่ม — ถ้าไม่มีใช้ overdueRate * maxDays
        const { data: bookData } = await supabase
          .from("borrow_records")
          .select(
            "book_copies!borrow_records_book_copy_id_fkey ( books ( id ) )",
          )
          .eq("id", targetRecordId)
          .maybeSingle();

        let bookPrice = overdueRate * maxDays; // fallback
        // ถ้ามี books table มี price column — ดึงมา
        const bookId = (bookData as any)?.book_copies?.books?.id;
        if (bookId) {
          const { data: priceRow } = await supabase
            .from("books")
            .select("price")
            .eq("id", bookId)
            .maybeSingle();
          if (priceRow?.price) bookPrice = Number(priceRow.price);
        }
        fineAmount = bookPrice;
        finalFineReason = "overdue";
      } else {
        fineAmount = daysOverdue * overdueRate;
        finalFineReason = "overdue";
      }
    }
  } else {
    // fallback ถ้าไม่มี fine_settings
    if (daysOverdue > 0) {
      fineAmount = daysOverdue * FINE_PER_DAY;
      finalFineReason = "overdue";
    }
  }

  // (e) UPDATE borrow_record
  const { error: updErr } = await supabase
    .from("borrow_records")
    .update({
      returned_at: now.toISOString(),
      status: "returned",
      fine_amount: fineAmount,
      fine_reason: finalFineReason,
    })
    .eq("id", targetRecordId);

  if (updErr) return { error: updErr.message, fineAmount: 0, bookTitle: null };

  // (f) UPDATE book_copy status → available
  if (copyId) {
    const { error: copyErr } = await supabase
      .from("book_copies")
      .update({ status: "available" })
      .eq("id", copyId);
    if (copyErr) return { error: copyErr.message, fineAmount: 0, bookTitle: null };
  }

  // (g) ถ้ามีค่าปรับ → สร้าง fine_payment + บวก fine_balance
  if (fineAmount > 0) {
    const { data: member } = await supabase
      .from("users")
      .select("fine_balance")
      .eq("id", user.id)
      .maybeSingle();

    const currentFine = Number(member?.fine_balance ?? 0);
    await supabase
      .from("users")
      .update({ fine_balance: currentFine + fineAmount })
      .eq("id", user.id);

    // สร้าง fine_payment record (status: pending)
    await supabase.from("fine_payments").insert({
      user_id: user.id,
      borrow_record_id: targetRecordId,
      fine_type: finalFineReason ?? "overdue",
      amount: fineAmount,
      description: `ค่าปรับ${finalFineReason === "overdue" ? `ล่าช้า ${daysOverdue} วัน` : ""}`,
      payment_method: "transfer",
      status: "pending",
    });
  }

  // (h) บันทึก Notification Queue + ส่ง LINE แบบ realtime ผ่าน after()
  const { data: memberInfo } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const memberName = (memberInfo as any)?.full_name ?? "-";

  // ดึง barcode ของ book_copy
  let copyBarcode = "-";
  if (copyId) {
    const { data: copyData } = await supabase
      .from("book_copies")
      .select("barcode")
      .eq("id", copyId)
      .maybeSingle();
    copyBarcode = (copyData as any)?.barcode ?? "-";
  }

  // ดึงวันที่ยืม
  const { data: borrowData } = await supabase
    .from("borrow_records")
    .select("borrowed_at")
    .eq("id", targetRecordId)
    .maybeSingle();
  const borrowDateStr = borrowData?.borrowed_at
    ? new Date(borrowData.borrowed_at).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "-";
  const returnDateStr = now.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const queueId = await enqueueLineNotification(user.id, {
    template: "return",
    title: "คืนหนังสือสำเร็จ",
    body: `คุณคืน "${bookTitle}" เรียบร้อยแล้ว`,
    action_url: "/member/loans",
    icon: "book",
    category: "loan",
    member_name: memberName,
    book_title: bookTitle ?? "หนังสือ",
    book_copy_no: copyBarcode,
    borrow_date: borrowDateStr,
    return_date: returnDateStr,
    fine_amount: fineAmount,
  });

  if (queueId) {
    after(() => sendQueuedLineNotification(queueId));
  }

  revalidatePath("/member/loans");
  return { error: null, fineAmount, bookTitle };
}

// ---------- 6. memberExtendAction ----------
/**
 * สมาชิกต่ออายุการยืมเอง (1 ครั้ง, +7 วัน)
 */
export async function memberExtendAction(
  formData: FormData,
): Promise<{ error: string | null; newDueDate: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", newDueDate: null };

  const recordId = String(formData.get("record_id") ?? "").trim();
  if (!recordId) return { error: "ไม่พบ ID รายการยืม", newDueDate: null };

  // ดึกรายการเพื่อตรวจความเป็นเจ้าของ + extension_count + status
  const { data: record, error: rErr } = await supabase
    .from("borrow_records")
    .select("id, user_id, book_copy_id, due_date, extension_count, status")
    .eq("id", recordId)
    .maybeSingle();

  if (rErr) return { error: rErr.message, newDueDate: null };
  if (!record) return { error: "ไม่พบรายการยืม", newDueDate: null };

  // ตรวจความเป็นเจ้าของ
  if (record.user_id !== user.id)
    return { error: "คุณไม่มีสิทธิ์ต่ออายุรายการนี้", newDueDate: null };

  // ตรวจ extension_count < 1
  const count = record.extension_count ?? 0;
  if (count >= MAX_EXTENSION)
    return {
      error: `ต่ออายุได้สูงสุด ${MAX_EXTENSION} ครั้งเท่านั้น`,
      newDueDate: null,
    };

  // ตรวจสถานะต้องเป็น borrowing หรือ overdue
  if (record.status !== "borrowing" && record.status !== "overdue")
    return { error: "รายการนี้ไม่สามารถต่ออายุได้", newDueDate: null };

  // คำนวณวันคืนใหม่ = due_date + 7 วัน
  const currentDue = new Date(record.due_date);
  currentDue.setDate(currentDue.getDate() + EXTENSION_DAYS);
  const newDue = currentDue.toISOString();

  const { error: updErr } = await supabase
    .from("borrow_records")
    .update({
      due_date: newDue,
      extension_count: count + 1,
    })
    .eq("id", recordId);

  if (updErr) return { error: updErr.message, newDueDate: null };

  // บันทึก Notification Queue + ส่ง LINE แบบ realtime ผ่าน after()
  const { data: bookInfo } = await supabase
    .from("book_copies")
    .select("barcode, books ( title )")
    .eq("id", record.book_copy_id)
    .maybeSingle();
  const bookTitle = (bookInfo as any)?.books?.title ?? "หนังสือ";
  const copyBarcode = (bookInfo as any)?.barcode ?? "-";

  const { data: memberInfo } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const memberName = (memberInfo as any)?.full_name ?? "-";

  const oldDueDateStr = new Date(record.due_date).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const newDueDateStr = new Date(newDue).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const queueId = await enqueueLineNotification(user.id, {
    template: "renew",
    title: "ต่ออายุการยืมสำเร็จ",
    body: `คุณต่ออายุ "${bookTitle}" วันคืนใหม่ ${newDueDateStr}`,
    action_url: "/member/loans",
    icon: "clock",
    category: "loan",
    member_name: memberName,
    book_title: bookTitle,
    book_copy_no: copyBarcode,
    old_due_date: oldDueDateStr,
    new_due_date: newDueDateStr,
    days_extended: EXTENSION_DAYS,
    extension_count: count,
    extension_limit: MAX_EXTENSION,
  });

  if (queueId) {
    after(() => sendQueuedLineNotification(queueId));
  }

  revalidatePath("/member/loans");
  return { error: null, newDueDate: newDue };
}

// ---------- 7. payFineAction ----------
/**
 * สมาชิกแจ้งชำระค่าปรับ → INSERT fine_payment (status='pending', payment_method='transfer')
 * เจ้าหน้าที่จะตรวจสอบและอนุมัติภายหลัง
 */
export async function payFineAction(
  formData: FormData,
): Promise<{ error: string | null; paymentId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", paymentId: null };

  const recordId = String(formData.get("record_id") ?? "").trim();
  if (!recordId) return { error: "ไม่พบ ID รายการยืม", paymentId: null };

  // ตรวจความเป็นเจ้าของ + fine_amount > 0
  const { data: record, error: rErr } = await supabase
    .from("borrow_records")
    .select("id, user_id, fine_amount, status")
    .eq("id", recordId)
    .maybeSingle();

  if (rErr) return { error: rErr.message, paymentId: null };
  if (!record) return { error: "ไม่พบรายการยืม", paymentId: null };
  if (record.user_id !== user.id)
    return { error: "คุณไม่มีสิทธิ์ชำระค่าปรับรายการนี้", paymentId: null };
  if (Number(record.fine_amount ?? 0) <= 0)
    return { error: "รายการนี้ไม่มีค่าปรับ", paymentId: null };

  // ตรวจว่ามีการแจ้งชำระอยู่แล้วหรือไม่ (pending)
  const { data: existingPayment } = await supabase
    .from("fine_payments")
    .select("id, status")
    .eq("borrow_record_id", recordId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPayment)
    return {
      error: "รายการนี้อยู่ระหว่างตรวจสอบการชำระเงินแล้ว",
      paymentId: (existingPayment as any).id,
    };

  // INSERT fine_payment
  const { data: payment, error: insertErr } = await supabase
    .from("fine_payments")
    .insert({
      borrow_record_id: recordId,
      user_id: user.id,
      amount: Number(record.fine_amount),
      payment_method: "transfer",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message, paymentId: null };
  if (!payment) return { error: "ไม่สามารถสร้างรายการชำระได้", paymentId: null };

  revalidatePath("/member/loans");
  return { error: null, paymentId: payment.id };
}

// ---------- 8. searchByBarcodeForMemberAction ----------
/**
 * ค้นหา book_copy ด้วยบาร์โค้ด สำหรับสมาชิก (เช็คสถานะ + ข้อมูลหนังสือ)
 */
export async function searchByBarcodeForMemberAction(
  barcode: string,
): Promise<{
  data: {
    book_copy_id: string;
    barcode: string;
    status: string;
    book_title: string;
    book_code: string;
    author: string | null;
    cover_image_url: string | null;
    shelf_location: string | null;
  } | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const b = barcode.trim();
  if (!b) return { data: null, error: "กรุณากรอกบาร์โค้ด" };

  const { data, error } = await supabase
    .from("book_copies")
    .select(
      `
      id, barcode, status,
      books!book_copies_book_id_fkey ( title, book_code, author, cover_image_url, shelf_location )
      `,
    )
    .eq("barcode", b)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "ไม่พบเล่มหนังสือที่บาร์โค้ดนี้" };

  const book = (data as any).books;
  return {
    data: {
      book_copy_id: (data as any).id,
      barcode: (data as any).barcode,
      status: (data as any).status,
      book_title: book?.title ?? "ไม่ระบุชื่อ",
      book_code: book?.book_code ?? "-",
      author: book?.author ?? null,
      cover_image_url: book?.cover_image_url ?? null,
      shelf_location: book?.shelf_location ?? null,
    },
    error: null,
  };
}