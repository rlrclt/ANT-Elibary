"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  enqueueLineNotification,
  sendQueuedLineNotification,
} from "@/utils/line-notify";

/**
 * Server Actions สำหรับ /staff/loans/returns (ตรวจสอบคำขอกลืนคืน)
 *
 * ภาพรวม:
 *   - สมาชิกส่งคำขอกลืนคืน (status='pending_return' + รูปถ่าย + สภาพหนังสือ)
 *   - เจ้าหน้าที่ดูรูป/สภาพ แล้วตัดสินใจ:
 *       • อนุมัติ (approve) → กำหนดค่าปรับเอง (สร้าง fine_payment สถานะ unpaid)
 *       • ปฏิเสธ (reject) → ส่งกลับให้สมาชิก (กลับเป็น borrowing/overdue)
 *   - ถ้าเกิน 7 วัน ไม่มีใครตรวจสอบ → auto-approve ผ่าน cron (utils/line-notify.ts)
 */

// ---------- Types ----------
export type PendingReturnRecord = {
  id: string;
  user_id: string;
  book_copy_id: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: string;
  fine_amount: number;
  fine_reason: string | null;
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
    price: number;
    book?: {
      title: string;
      book_code: string;
      cover_image_url: string | null;
    } | null;
  } | null;
};

type ActionResult<T> = { data: T | null; error: string | null };

// ---------- Auth helper ----------
async function requireStaff(): Promise<{
  ok: boolean;
  error: string | null;
  userId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ", userId: null };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    return { ok: false, error: "ไม่มีสิทธิ์เข้าถึง (ต้องเป็น staff/admin)", userId: null };
  }
  return { ok: true, error: null, userId: user.id };
}

// ---------- 1. getPendingReturnsAction ----------
/**
 * ดึงรายการคำขอกลืนคืนที่รอตรวจสอบ (status='pending_return')
 * เรียงตามเวลาที่ส่งคำขอ (เก่าสุดก่อน — เล่มที่รอเกิน 7 วันจะเห็นเด่น)
 */
export async function getPendingReturnsAction(): Promise<
  ActionResult<PendingReturnRecord[]>
> {
  const auth = await requireStaff();
  if (!auth.ok) return { data: null, error: auth.error };

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
        barcode, status, condition, price,
        books!book_copies_book_id_fkey ( title, book_code, cover_image_url )
      )
      `,
    )
    .eq("status", "pending_return")
    .order("return_requested_at", { ascending: true });

  if (error) return { data: null, error: error.message };

  const records: PendingReturnRecord[] = (data ?? []).map((r: any) => ({
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
          price: Number(r.book_copies.price ?? 0),
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

// ---------- 2. approveReturnAction ----------
/**
 * เจ้าหน้าที่อนุมัติคำขอกลืนคืน:
 *   - บันทึกวันคืนจริง + สถานะ returned
 *   - เจ้าหน้าที่กำหนดค่าปรับเอง (fine_amount + fine_reason)
 *   - เล่มคืนกลับเป็น available หรือ damaged (ตามสภาพที่ตรวจ)
 *   - ถ้ามีค่าปรับ → สร้าง fine_payment (status='unpaid') — สมาชิกเลือกวิธีชำระเอง
 *   - ถ้าชำรุด → สร้าง damaged_records (บล็อกการยืมของสมาชิกจนกว่าจะชดใช้)
 *
 * formData: record_id, fine_amount, fine_reason, remark, condition_after
 */
export async function approveReturnAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const recordId = String(formData.get("record_id") ?? "").trim();
  const fineAmount = Number(formData.get("fine_amount") ?? 0);
  const fineReason = String(formData.get("fine_reason") ?? "other").trim();
  const remark = String(formData.get("remark") ?? "").trim() || null;
  const conditionAfter = String(formData.get("condition_after") ?? "normal").trim();

  if (!recordId) return { error: "ไม่พบ ID รายการยืม" };
  if (isNaN(fineAmount) || fineAmount < 0)
    return { error: "ยอดค่าปรับไม่ถูกต้อง" };

  // ดึงรายการ (ตรวจสถานะ pending_return + book_copy_id + user_id)
  const { data: record, error: rErr } = await supabase
    .from("borrow_records")
    .select(
      `
      id, user_id, book_copy_id, due_date, status, return_requested_at,
      return_condition, return_photo_url
      `,
    )
    .eq("id", recordId)
    .maybeSingle();

  if (rErr) return { error: rErr.message };
  if (!record) return { error: "ไม่พบรายการยืม" };
  if (record.status !== "pending_return")
    return { error: "รายการนี้ไม่อยู่ในสถานะรอตรวจสอบ" };

  const now = new Date().toISOString();

  // (a) อัปเดต borrow_record → returned + กำหนดค่าปรับ
  const { error: updErr } = await supabase
    .from("borrow_records")
    .update({
      returned_at: now,
      status: "returned",
      fine_amount: fineAmount,
      fine_reason: fineAmount > 0 ? (fineReason as "overdue" | "damaged" | "lost" | "other") : null,
      remark,
      handled_by: auth.userId,
    })
    .eq("id", recordId);

  if (updErr) return { error: updErr.message };

  // (b) อัปเดตสถานะเล่มตามสภาพที่ตรวจ
  const isDamaged = conditionAfter === "damaged";
  const { error: copyErr } = await supabase
    .from("book_copies")
    .update({ status: isDamaged ? "damaged" : "available" })
    .eq("id", record.book_copy_id);

  if (copyErr) return { error: copyErr.message };

  // (c) ถ้าชำรุด → สร้าง damaged_records (ผูกผู้ยืม) + fine_payment (unpaid) เต็มราคา
  let fullPriceFine = 0;
  if (isDamaged) {
    const { data: copyPrice } = await supabase
      .from("book_copies")
      .select("price")
      .eq("id", record.book_copy_id)
      .maybeSingle();
    fullPriceFine = Number(copyPrice?.price ?? fineAmount ?? 0);

    const { data: damagedRow, error: damagedErr } = await supabase
      .from("damaged_records")
      .insert({
        book_copy_id: record.book_copy_id,
        borrow_record_id: record.id,
        user_id: record.user_id,
        status: "unresolved",
        fine_amount: fullPriceFine,
        note: remark || "ตรวจพบความชำรุดตอนคืนหนังสือ (จากคำขอกลืนคืน)",
        handled_by: auth.userId,
      })
      .select("id")
      .single();

    if (damagedErr) return { error: damagedErr.message };

    if (damagedRow?.id && fullPriceFine > 0) {
      const { error: payErr } = await supabase.from("fine_payments").insert({
        user_id: record.user_id,
        borrow_record_id: record.id,
        damaged_record_id: damagedRow.id,
        fine_type: "damaged",
        amount: fullPriceFine,
        description: "ค่าชดใช้หนังสือชำรุด (เต็มราคาเล่ม)",
        payment_method: null,
        status: "unpaid",
      });
      if (payErr) return { error: payErr.message };
    }
  }

  // (d) ถ้ามีค่าปรับ (ไม่ใช่ชำรุด — จัดการใน (c) แล้ว) → สร้าง fine_payment (unpaid)
  if (fineAmount > 0 && !isDamaged) {
    const { error: payErr } = await supabase.from("fine_payments").insert({
      user_id: record.user_id,
      borrow_record_id: record.id,
      damaged_record_id: null,
      fine_type: fineReason,
      amount: fineAmount,
      description: `ค่าปรับการคืนหนังสือ (${fineReason === "overdue" ? "คืนล่าช้า" : "อื่นๆ"})`,
      payment_method: null,
      status: "unpaid",
    });
    if (payErr) return { error: payErr.message };
  }

  // (e) แจ้งเตือน LINE สมาชิก ผ่าน after()
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

  const returnDateStr = new Date(now).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let fineText = "";
  if (fineAmount > 0) {
    fineText = ` ค่าปรับ ${fineAmount.toLocaleString("en-US")} บาท — กรุณาชำระผ่าน /member/fines`;
  } else if (isDamaged) {
    fineText = " ตรวจพบความชำรุด — ติดต่อเจ้าหน้าที่เพื่อชดใช้";
  }

  const queueId = await enqueueLineNotification(record.user_id, {
    template: "return",
    title: "คำขอกลืนคืนได้รับการอนุมัติ",
    body: `เจ้าหน้าที่ตรวจสอบ "${bookTitle}" เรียบร้อยแล้ว${fineText}`,
    action_url: "/member/loans",
    icon: "check-circle",
    category: "loan",
    member_name: memberName,
    book_title: bookTitle,
    book_copy_no: copyBarcode,
    borrow_date: returnDateStr,
    return_date: returnDateStr,
    fine_amount: fineAmount,
  });

  if (queueId) {
    after(() => sendQueuedLineNotification(queueId));
  }

  revalidatePath("/staff/loans/returns");
  revalidatePath("/staff/loans");
  return { error: null };
}

// ---------- 3. rejectReturnAction ----------
/**
 * เจ้าหน้าที่ปฏิเสธคำขอกลืนคืน:
 *   - กลับเป็นสถานะ borrowing / overdue (ตาม due_date)
 *   - เคลียร์ข้อมูลคำขอ (return_*)
 *   - บันทึกเหตุผลใน remark
 */
export async function rejectReturnAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const recordId = String(formData.get("record_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || "เจ้าหน้าที่ปฏิเสธคำขอกลืนคืน";

  if (!recordId) return { error: "ไม่พบ ID รายการยืม" };

  const { data: record, error: rErr } = await supabase
    .from("borrow_records")
    .select("id, user_id, book_copy_id, due_date, status, remark")
    .eq("id", recordId)
    .maybeSingle();

  if (rErr) return { error: rErr.message };
  if (!record) return { error: "ไม่พบรายการยืม" };
  if (record.status !== "pending_return")
    return { error: "รายการนี้ไม่อยู่ในสถานะรอตรวจสอบ" };

  // สถานะใหม่: overdue ถ้าครบกำหนดแล้ว ไม่เช่นนั้นกลับเป็น borrowing
  const isOverdue = new Date(record.due_date) < new Date();
  const newStatus = isOverdue ? "overdue" : "borrowing";

  const combinedRemark = [record.remark, `ปฏิเสธคำขอกลืนคืน: ${reason}`]
    .filter(Boolean)
    .join(" | ");

  const { error: updErr } = await supabase
    .from("borrow_records")
    .update({
      status: newStatus,
      return_requested_at: null,
      return_photo_url: null,
      return_condition: null,
      remark: combinedRemark,
      handled_by: auth.userId,
    })
    .eq("id", recordId);

  if (updErr) return { error: updErr.message };

  // แจ้งเตือน LINE สมาชิก
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

  const dateStr = new Date().toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const queueId = await enqueueLineNotification(record.user_id, {
    template: "return",
    title: "คำขอกลืนคืนถูกปฏิเสธ",
    body: `เจ้าหน้าที่ตรวจสอบ "${bookTitle}" แล้วไม่ผ่าน: ${reason} โปรดติดต่อเจ้าหน้าที่ห้องสมุด`,
    action_url: "/member/loans",
    icon: "warning-circle",
    category: "loan",
    member_name: memberName,
    book_title: bookTitle,
    book_copy_no: copyBarcode,
    borrow_date: dateStr,
    return_date: dateStr,
    fine_amount: 0,
  });

  if (queueId) {
    after(() => sendQueuedLineNotification(queueId));
  }

  revalidatePath("/staff/loans/returns");
  revalidatePath("/staff/loans");
  return { error: null };
}
