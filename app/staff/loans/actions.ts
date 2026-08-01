"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  enqueueLineNotification,
  sendQueuedLineNotification,
} from "@/utils/line-notify";

/**
 * Server Actions สำหรับ /staff/loans (ระบบยืม-คืน)
 * ทำงานฝั่ง server ผ่าน supabase server client
 * จัดการ borrow_records, book_copies, users (fine_balance)
 *
 * การแจ้งเตือน LINE: ใช้ after() + Notification Queue
 *   - บันทึก Queue (status=pending) หลังธุรกรรมหลักสำเร็จ
 *   - after() ส่ง LINE ทันทีหลัง response กลับ (realtime)
 *   - ถ้าส่งไม่สำเร็จ → คง pending ให้ cron retry อัตโนมัติ
 *   - การยืม/คืน (Critical) ไม่ขึ้นกับ LINE (Non-Critical)
 */

// ---------- Types ----------
export type BorrowRecord = {
  id: string;
  user_id: string;
  book_copy_id: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: "borrowing" | "returned" | "overdue" | "lost" | "pending_return";
  fine_amount: number;
  fine_reason: "overdue" | "damaged" | "lost" | "other" | null;
  remark: string | null;
  extension_count: number;
  handled_by: string | null;
  return_requested_at: string | null;
  return_photo_url: string | null;
  return_condition: "normal" | "slight_damage" | "damaged" | null;
  user?: {
    full_name: string;
    user_id_code: string;
  } | null;
  book_copy?: {
    barcode: string;
    status: string;
    condition: string | null;
    book?: {
      title: string;
      book_code: string;
      cover_image_url: string | null;
    } | null;
  } | null;
};

export type LoanStats = {
  active: number;
  overdue: number;
  returnedToday: number;
  totalFines: number;
};

type ActionResult<T> = { data: T | null; error: string | null };

// ---------- 0. hasUnresolvedDamaged ----------
/**
 * ตรวจว่าสมาชิกมีรายการหนังสือชำรุดที่ยังค้างชดใช้อยู่หรือไม่
 * ถ้ามี → บล็อกการยืมเล่มใหม่จนกว่าจะจ่ายค่าปรับเต็มราคาหรือซื้อหนังสือมาคืน
 */
async function hasUnresolvedDamaged(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("damaged_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "unresolved");
  return (count ?? 0) > 0;
}

// ---------- 1. getActiveBorrowsAction ----------
export async function getActiveBorrowsAction(filters?: {
  search?: string;
  status?: "all" | "borrowing" | "overdue";
}): Promise<ActionResult<BorrowRecord[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("borrow_records")
    .select(
      `
      id, user_id, book_copy_id, borrowed_at, due_date, returned_at,
      status, fine_amount, fine_reason, remark, extension_count, handled_by,
      return_requested_at, return_photo_url, return_condition,
      users!borrow_records_user_id_fkey ( full_name, user_id_code ),
      book_copies!borrow_records_book_copy_id_fkey (
        barcode, status, condition,
        books!book_copies_book_id_fkey ( title, book_code, cover_image_url )
      )
      `,
    )
    .is("returned_at", null)
    .order("borrowed_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };

  // คัดกรองด้วย search (ชื่อสมาชิก/รหัสสมาชิก/barcode) ฝั่ง JS เพราะ join ลึกเกินไปสำหรับ or()
  let records: BorrowRecord[] = (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    book_copy_id: r.book_copy_id,
    borrowed_at: r.borrowed_at,
    due_date: r.due_date,
    returned_at: r.returned_at,
    status: r.status,
    fine_amount: Number(r.fine_amount ?? 0),
    fine_reason: r.fine_reason ?? null,
    remark: r.remark ?? null,
    extension_count: r.extension_count ?? 0,
    handled_by: r.handled_by ?? null,
    return_requested_at: r.return_requested_at ?? null,
    return_photo_url: r.return_photo_url ?? null,
    return_condition: r.return_condition ?? null,
    user: r.users
      ? {
          full_name: r.users.full_name,
          user_id_code: r.users.user_id_code,
        }
      : null,
    book_copy: r.book_copies
      ? {
          barcode: r.book_copies.barcode,
          status: r.book_copies.status,
          condition: r.book_copies.condition,
          book: r.book_copies.books
            ? {
                title: r.book_copies.books.title,
                book_code: r.book_copies.books.book_code,
                cover_image_url: r.book_copies.books.cover_image_url,
              }
            : null,
        }
      : null,
  }));

  if (filters?.search) {
    const s = filters.search.trim().toLowerCase();
    records = records.filter((r) => {
      const name = r.user?.full_name?.toLowerCase() ?? "";
      const code = r.user?.user_id_code?.toLowerCase() ?? "";
      const barcode = r.book_copy?.barcode?.toLowerCase() ?? "";
      return name.includes(s) || code.includes(s) || barcode.includes(s);
    });
  }

  return { data: records, error: null };
}

// ---------- 2. getLoanStatsAction ----------
export async function getLoanStatsAction(): Promise<{
  data: LoanStats;
  error: string | null;
}> {
  const supabase = await createClient();

  // วันนี้เริ่มต้นที่ 00:00 ตามเวลาท้องถิ่น
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();

  const [
    { count: activeCount },
    { count: overdueCount },
    { count: returnedTodayCount },
    { data: finesData },
  ] = await Promise.all([
    supabase
      .from("borrow_records")
      .select("*", { count: "exact", head: true })
      .is("returned_at", null)
      .eq("status", "borrowing"),
    supabase
      .from("borrow_records")
      .select("*", { count: "exact", head: true })
      .eq("status", "overdue"),
    supabase
      .from("borrow_records")
      .select("*", { count: "exact", head: true })
      .not("returned_at", "is", null)
      .gte("returned_at", startOfToday),
    supabase
      .from("borrow_records")
      .select("fine_amount")
      .gt("fine_amount", 0),
  ]);

  const totalFines =
    finesData?.reduce((sum: number, r: any) => sum + Number(r.fine_amount ?? 0), 0) ?? 0;

  return {
    data: {
      active: activeCount ?? 0,
      overdue: overdueCount ?? 0,
      returnedToday: returnedTodayCount ?? 0,
      totalFines: totalFines,
    },
    error: null,
  };
}

// ---------- 3. getMemberActiveBorrowsAction ----------
export async function getMemberActiveBorrowsAction(
  userId: string,
): Promise<ActionResult<BorrowRecord[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("borrow_records")
    .select(
      `
      id, user_id, book_copy_id, borrowed_at, due_date, returned_at,
      status, fine_amount, fine_reason, remark, extension_count, handled_by,
      return_requested_at, return_photo_url, return_condition,
      users!borrow_records_user_id_fkey ( full_name, user_id_code ),
      book_copies!borrow_records_book_copy_id_fkey (
        barcode, status, condition,
        books!book_copies_book_id_fkey ( title, book_code, cover_image_url )
      )
      `,
    )
    .eq("user_id", userId)
    .is("returned_at", null)
    .order("borrowed_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const records: BorrowRecord[] = (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    book_copy_id: r.book_copy_id,
    borrowed_at: r.borrowed_at,
    due_date: r.due_date,
    returned_at: r.returned_at,
    status: r.status,
    fine_amount: Number(r.fine_amount ?? 0),
    fine_reason: r.fine_reason ?? null,
    remark: r.remark ?? null,
    extension_count: r.extension_count ?? 0,
    handled_by: r.handled_by ?? null,
    return_requested_at: r.return_requested_at ?? null,
    return_photo_url: r.return_photo_url ?? null,
    return_condition: r.return_condition ?? null,
    user: r.users
      ? {
          full_name: r.users.full_name,
          user_id_code: r.users.user_id_code,
        }
      : null,
    book_copy: r.book_copies
      ? {
          barcode: r.book_copies.barcode,
          status: r.book_copies.status,
          condition: r.book_copies.condition,
          book: r.book_copies.books
            ? {
                title: r.book_copies.books.title,
                book_code: r.book_copies.books.book_code,
                cover_image_url: r.book_copies.books.cover_image_url,
              }
            : null,
        }
      : null,
  }));

  return { data: records, error: null };
}

// ---------- 4. borrowBookAction ----------
export async function borrowBookAction(
  formData: FormData,
): Promise<{ error: string | null; recordId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", recordId: null };

  const userId = String(formData.get("user_id") ?? "").trim();
  const barcode = String(formData.get("barcode") ?? "").trim();
  const bookCopyId = String(formData.get("book_copy_id") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();

  if (!userId) return { error: "กรุณาเลือกสมาชิก", recordId: null };
  if (!barcode && !bookCopyId)
    return { error: "กรุณากรอกบาร์โค้ดหรือเลือกเล่มหนังสือ", recordId: null };
  if (!dueDate) return { error: "กรุณาระบุวันกำหนดคืน", recordId: null };

  // (a) หา book_copy และตรวจสถานะ available
  type BookCopyRow = {
    id: string;
    status: string;
    books?: { status?: string } | null;
  };
  let copy: BookCopyRow | null = null;
  if (bookCopyId) {
    const { data, error: cErr } = await supabase
      .from("book_copies")
      .select("id, status, books!book_copies_book_id_fkey ( status )")
      .eq("id", bookCopyId)
      .maybeSingle();
    if (cErr) return { error: cErr.message, recordId: null };
    copy = data as BookCopyRow | null;
  } else {
    const { data, error: cErr } = await supabase
      .from("book_copies")
      .select("id, status, books!book_copies_book_id_fkey ( status )")
      .eq("barcode", barcode)
      .maybeSingle();
    if (cErr) return { error: cErr.message, recordId: null };
    copy = data as BookCopyRow | null;
  }

  if (!copy) return { error: "ไม่พบเล่มหนังสือที่ระบุ", recordId: null };
  if (copy.status !== "available")
    return { error: "เล่มนี้ไม่พร้อมยืม (สถานะปัจจุบันไม่ใช่ available)", recordId: null };
  // บล็อกหนังสือเก่า (status='old' ของเล่มแม่) — ไม่ให้ยืม
  if (copy.books?.status === "old")
    return {
      error: "หนังสือเล่มนี้เป็นหนังสือเก่า (อายุ 5 ปีขึ้นไป) ไม่สามารถยืมได้",
      recordId: null,
    };

  // (b) ตรวจสถานะสมาชิกและจำนวนยืมปัจจุบัน
  const { data: member, error: mErr } = await supabase
    .from("users")
    .select("id, status, borrow_limit")
    .eq("id", userId)
    .maybeSingle();

  if (mErr) return { error: mErr.message, recordId: null };
  if (!member) return { error: "ไม่พบข้อมูลสมาชิก", recordId: null };
  if (member.status !== "active")
    return { error: "สมาชิกไม่อยู่ในสถานะใช้งาน ไม่สามารถยืมได้", recordId: null };

  // บล็อกการยืมถ้ามีหนังสือชำรุดค้างชดใช้
  if (await hasUnresolvedDamaged(userId))
    return {
      error: "สมาชิกมีหนังสือชำรุดค้างชดใช้ ต้องจ่ายค่าปรับเต็มราคาหรือซื้อหนังสือมาคืนก่อน",
      recordId: null,
    };

  const { count: currentBorrows } = await supabase
    .from("borrow_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("returned_at", null);

  const limit = member.borrow_limit ?? 5;
  if ((currentBorrows ?? 0) >= limit)
    return {
      error: `สมาชิกยืมครบจำนวนจำกัดแล้ว (${limit} เล่ม)`,
      recordId: null,
    };

  // (c) INSERT borrow_record
  const { data: record, error: insertErr } = await supabase
    .from("borrow_records")
    .insert({
      user_id: userId,
      book_copy_id: copy.id,
      due_date: dueDate,
      status: "borrowing",
      handled_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message, recordId: null };
  if (!record) return { error: "ไม่สามารถสร้างรายการยืมได้", recordId: null };

  // (d) UPDATE book_copy status → borrowed
  const { error: updErr } = await supabase
    .from("book_copies")
    .update({ status: "borrowed" })
    .eq("id", copy.id);

  if (updErr) {
    // rollback: ลบ borrow record ที่เพิ่งสร้าง
    await supabase.from("borrow_records").delete().eq("id", record.id);
    return { error: updErr.message, recordId: null };
  }

  // (e) บันทึก Notification Queue + ส่ง LINE แบบ realtime ผ่าน after()
  // ดึงข้อมูลหนังสือ + สมาชิก + barcode สำหรับ Flex Message
  const { data: bookInfo } = await supabase
    .from("book_copies")
    .select("barcode, books ( title )")
    .eq("id", copy.id)
    .maybeSingle();
  const bookTitle = (bookInfo as any)?.books?.title ?? "หนังสือ";
  const copyBarcode = (bookInfo as any)?.barcode ?? "-";

  const { data: memberInfo } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  const memberName = (memberInfo as any)?.full_name ?? "-";

  const borrowDateStr = new Date().toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dueDateStr = new Date(dueDate).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const queueId = await enqueueLineNotification(userId, {
    template: "borrow",
    title: "ยืมหนังสือสำเร็จ",
    body: `คุณยืม "${bookTitle}" ครบกำหนดคืน ${dueDateStr}`,
    action_url: "/member/loans",
    icon: "book-open",
    category: "loan",
    member_name: memberName,
    book_title: bookTitle,
    book_copy_no: copyBarcode,
    borrow_date: borrowDateStr,
    due_date: dueDateStr,
  });

  console.log("[borrowAction] enqueue result:", { queueId, userId, bookTitle });

  if (queueId) {
    // after() ทำงานหลัง response กลับไปแล้ว — ไม่บล็อกการยืม
    after(() => sendQueuedLineNotification(queueId));
  } else {
    console.warn("[borrowAction] enqueue failed — queue will be empty");
  }

  revalidatePath("/staff/loans");
  return { error: null, recordId: record.id };
}

// ---------- 5. returnBookAction ----------
export async function returnBookAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const recordId = String(formData.get("record_id") ?? "").trim();
  const fineAmountStr = String(formData.get("fine_amount") ?? "").trim();
  const fineReason = String(formData.get("fine_reason") ?? "").trim() || null;
  const remark = String(formData.get("remark") ?? "").trim() || null;

  if (!recordId) return { error: "ไม่พบ ID รายการยืม" };

  const fineAmount = fineAmountStr ? parseFloat(fineAmountStr) : 0;

  // (a) ดึง borrow_record และตรวจสถานะ
  const { data: record, error: rErr } = await supabase
    .from("borrow_records")
    .select("id, user_id, book_copy_id, status")
    .eq("id", recordId)
    .maybeSingle();

  if (rErr) return { error: rErr.message };
  if (!record) return { error: "ไม่พบรายการยืม" };
  if (record.status !== "borrowing" && record.status !== "overdue")
    return { error: "รายการนี้ไม่อยู่ในสถานะที่สามารถคืนได้" };

  // (b) UPDATE borrow_record
  const { error: updErr } = await supabase
    .from("borrow_records")
    .update({
      returned_at: new Date().toISOString(),
      status: "returned",
      fine_amount: fineAmount,
      fine_reason: fineAmount > 0 ? (fineReason as "overdue" | "damaged" | "lost" | "other") : null,
      remark,
      handled_by: user.id,
    })
    .eq("id", recordId);

  if (updErr) return { error: updErr.message };

  // (c) UPDATE book_copy status → available (ปกติ) หรือ damaged (ถ้าคืนชำรุด)
  const isDamagedReturn = fineReason === "damaged";
  const { error: copyErr } = await supabase
    .from("book_copies")
    .update({ status: isDamagedReturn ? "damaged" : "available" })
    .eq("id", record.book_copy_id);

  if (copyErr) return { error: copyErr.message };

  // (c2) ถ้าคืนชำรุด → สร้าง damaged_records + fine_payments (ผูก user ที่ยืม)
  let damagedRecordId: string | null = null;
  if (isDamagedReturn) {
    // ดึงราคาเต็มเล่ม (จาก book_copies.price) เพื่อเป็นยอดชดใช้
    const { data: copyPrice } = await supabase
      .from("book_copies")
      .select("price")
      .eq("id", record.book_copy_id)
      .maybeSingle();
    const fullPrice = Number(copyPrice?.price ?? fineAmount ?? 0);

    // สร้างรายการชำรุด (status=unresolved) — บล็อกการยืมของ user อัตโนมัติ
    const { data: damagedRow, error: damagedErr } = await supabase
      .from("damaged_records")
      .insert({
        book_copy_id: record.book_copy_id,
        borrow_record_id: record.id,
        user_id: record.user_id,
        status: "unresolved",
        fine_amount: fullPrice,
        note: remark || "ตรวจพบความชำรุดตอนคืนหนังสือ",
        handled_by: user.id,
      })
      .select("id")
      .single();

    if (damagedErr) return { error: damagedErr.message };
    damagedRecordId = damagedRow?.id ?? null;

    // สร้าง fine_payment (pending) ให้สมาชิกเห็นใน /member/fines และชำระผ่านสลิปได้
    if (damagedRecordId && fullPrice > 0) {
      const { error: payErr } = await supabase.from("fine_payments").insert({
        user_id: record.user_id,
        borrow_record_id: record.id,
        damaged_record_id: damagedRecordId,
        fine_type: "damaged",
        amount: fullPrice,
        description: "ค่าชดใช้หนังสือชำรุด (เต็มราคาเล่ม)",
        payment_method: "transfer",
        status: "pending",
      });
      if (payErr) return { error: payErr.message };
    }
  }

  // (d) ถ้ามีค่าปรับ → บวก fine_balance ของสมาชิก
  if (fineAmount > 0 && record.user_id) {
    // ดึง fine_balance ปัจจุบันก่อนเพื่อหลีกเลี่ยง race condition
    const { data: member } = await supabase
      .from("users")
      .select("fine_balance")
      .eq("id", record.user_id)
      .maybeSingle();

    const currentFine = Number(member?.fine_balance ?? 0);
    await supabase
      .from("users")
      .update({ fine_balance: currentFine + fineAmount })
      .eq("id", record.user_id);
  }

  // (e) บันทึก Notification Queue + ส่ง LINE แบบ realtime ผ่าน after()
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
    .eq("id", record.user_id)
    .maybeSingle();
  const memberName = (memberInfo as any)?.full_name ?? "-";

  // ดึงวันที่ยืมจาก borrow_record
  const { data: borrowData } = await supabase
    .from("borrow_records")
    .select("borrowed_at")
    .eq("id", recordId)
    .maybeSingle();
  const borrowDateStr = borrowData?.borrowed_at
    ? new Date(borrowData.borrowed_at).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "-";
  const returnDateStr = new Date().toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const queueId = await enqueueLineNotification(record.user_id, {
    template: "return",
    title: "คืนหนังสือสำเร็จ",
    body: `คุณคืน "${bookTitle}" เรียบร้อยแล้ว`,
    action_url: "/member/loans",
    icon: "book",
    category: "loan",
    member_name: memberName,
    book_title: bookTitle,
    book_copy_no: copyBarcode,
    borrow_date: borrowDateStr,
    return_date: returnDateStr,
    fine_amount: fineAmount,
  });

  if (queueId) {
    after(() => sendQueuedLineNotification(queueId));
  }

  revalidatePath("/staff/loans");
  return { error: null };
}

// ---------- 6. extendDueDateAction ----------
export async function extendDueDateAction(
  formData: FormData,
): Promise<{ error: string | null; newDueDate: string | null }> {
  const supabase = await createClient();

  const recordId = String(formData.get("record_id") ?? "").trim();
  if (!recordId) return { error: "ไม่พบ ID รายการยืม", newDueDate: null };

  // ดึกรายการเพื่อตรวจ extension_count + user_id + book_copy_id
  const { data: record, error: rErr } = await supabase
    .from("borrow_records")
    .select("id, user_id, book_copy_id, due_date, extension_count, status")
    .eq("id", recordId)
    .maybeSingle();

  if (rErr) return { error: rErr.message, newDueDate: null };
  if (!record) return { error: "ไม่พบรายการยืม", newDueDate: null };

  const count = record.extension_count ?? 0;
  if (count >= 1)
    return { error: "ต่ออายุได้สูงสุด 1 ครั้งเท่านั้น", newDueDate: null };

  if (record.status !== "borrowing" && record.status !== "overdue")
    return { error: "รายการนี้ไม่สามารถต่ออายุได้", newDueDate: null };

  // คำนวณวันคืนใหม่ = due_date + 7 วัน
  const currentDue = new Date(record.due_date);
  currentDue.setDate(currentDue.getDate() + 7);
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
    .eq("id", record.user_id)
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

  const queueId = await enqueueLineNotification(record.user_id, {
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
    days_extended: 7,
    extension_count: count,
    extension_limit: 1,
  });

  if (queueId) {
    after(() => sendQueuedLineNotification(queueId));
  }

  revalidatePath("/staff/loans");
  return { error: null, newDueDate: newDue };
}

// ---------- 7. markAsLostAction ----------
export async function markAsLostAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const recordId = String(formData.get("record_id") ?? "").trim();
  const fineAmountStr = String(formData.get("fine_amount") ?? "").trim();
  if (!recordId) return { error: "ไม่พบ ID รายการยืม" };

  const fineAmount = fineAmountStr ? parseFloat(fineAmountStr) : 0;

  // ดึกรายการยืม
  const { data: record, error: rErr } = await supabase
    .from("borrow_records")
    .select("id, user_id, book_copy_id, status")
    .eq("id", recordId)
    .maybeSingle();

  if (rErr) return { error: rErr.message };
  if (!record) return { error: "ไม่พบรายการยืม" };
  if (record.status !== "borrowing" && record.status !== "overdue")
    return { error: "รายการนี้ไม่อยู่ในสถานะที่แจ้งสูญหายได้" };

  // UPDATE borrow_record → status='lost', fine_amount
  const { error: updErr } = await supabase
    .from("borrow_records")
    .update({
      status: "lost",
      fine_amount: fineAmount,
      fine_reason: fineAmount > 0 ? "lost" : null,
      handled_by: user.id,
    })
    .eq("id", recordId);

  if (updErr) return { error: updErr.message };

  // UPDATE book_copy → status='lost'
  const { error: copyErr } = await supabase
    .from("book_copies")
    .update({ status: "lost" })
    .eq("id", record.book_copy_id);

  if (copyErr) return { error: copyErr.message };

  // ถ้ามีค่าปรับ → บวก fine_balance
  if (fineAmount > 0 && record.user_id) {
    const { data: member } = await supabase
      .from("users")
      .select("fine_balance")
      .eq("id", record.user_id)
      .maybeSingle();

    const currentFine = Number(member?.fine_balance ?? 0);
    await supabase
      .from("users")
      .update({ fine_balance: currentFine + fineAmount })
      .eq("id", record.user_id);
  }

  revalidatePath("/staff/loans");
  return { error: null };
}

// ---------- 8. searchMemberAction ----------
export async function searchMemberAction(
  query: string,
): Promise<{
  data: { id: string; full_name: string; user_id_code: string; role: string; status: string }[];
  error: string | null;
}> {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return { data: [], error: null };

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, user_id_code, role, status")
    .or(`full_name.ilike.%${q}%,user_id_code.ilike.%${q}%`)
    .order("full_name", { ascending: true })
    .limit(10);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

// ---------- 9. searchByBarcodeAction ----------
export async function searchByBarcodeAction(
  barcode: string,
): Promise<{
  data: {
    book_copy_id: string;
    barcode: string;
    status: string;
    book_title: string;
    book_code: string;
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
      books!book_copies_book_id_fkey ( title, book_code, cover_image_url, shelf_location )
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
      cover_image_url: book?.cover_image_url ?? null,
      shelf_location: book?.shelf_location ?? null,
    },
    error: null,
  };
}