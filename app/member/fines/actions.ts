"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /member/fines (ค่าปรับของฉัน + แนบสลิป)
 *
 * ตาราง:
 *   - public.fine_payments (รายการชำระค่าปรับของสมาชิก)
 *   - public.users (fine_balance)
 *   - public.payment_methods (QR code บัญชี สำหรับสมาชิกเลือกโอน)
 *
 * Storage bucket: media (สลิปการโอนเงิน)
 */

const MAX_SLIP_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_SLIP_MIME = ["image/jpeg", "image/png"];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

// ---------- Types ----------
export type MyFinePayment = {
  id: string;
  amount: number;
  fine_type: string;
  description: string | null;
  status: string;
  payment_method: string | null;
  slip_url: string | null;
  slip_uploaded_at: string | null;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  borrow_record_id: string | null;
};

export type MemberPaymentMethod = {
  id: string;
  name: string;
  account_name: string | null;
  account_number: string | null;
  qr_image_url: string | null;
};

type ActionResult<T> = { data: T | null; error: string | null };

// ---------- Auth helper ----------
async function requireMember(): Promise<{
  ok: boolean;
  error: string | null;
  userId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ", userId: null };
  return { ok: true, error: null, userId: user.id };
}

// ---------- 1. getMyFinesAction ----------
/**
 * ดึงรายการชำระค่าปรับทั้งหมดของสมาชิกที่ล็อกอินอยู่
 * เรียงตาม created_at ล่าสุดก่อน
 */
export async function getMyFinesAction(): Promise<
  ActionResult<MyFinePayment[]>
> {
  const auth = await requireMember();
  if (!auth.ok) return { data: null, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fine_payments")
    .select(
      "id, amount, fine_type, description, status, payment_method, slip_url, slip_uploaded_at, created_at, reviewed_at, review_note, borrow_record_id",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const rows: MyFinePayment[] = (data ?? []).map((r: any) => ({
    id: r.id,
    amount: Number(r.amount ?? 0),
    fine_type: r.fine_type,
    description: r.description ?? null,
    status: r.status,
    payment_method: r.payment_method ?? null,
    slip_url: r.slip_url ?? null,
    slip_uploaded_at: r.slip_uploaded_at ?? null,
    created_at: r.created_at,
    reviewed_at: r.reviewed_at ?? null,
    review_note: r.review_note ?? null,
    borrow_record_id: r.borrow_record_id ?? null,
  }));

  return { data: rows, error: null };
}

// ---------- 2. getPaymentMethodsAction ----------
/**
 * ดึงวิธีการชำระเงินที่ใช้งานอยู่ (สำหรับสมาชิกดู QR/บัญชีเพื่อโอน)
 */
export async function getPaymentMethodsAction(): Promise<
  ActionResult<MemberPaymentMethod[]>
> {
  const auth = await requireMember();
  if (!auth.ok) return { data: null, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name, account_name, account_number, qr_image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return { data: null, error: error.message };

  return { data: (data as MemberPaymentMethod[]) ?? [], error: null };
}

// ---------- 3. uploadSlipAction ----------
/**
 * สมาชิกแนบสลิปการโอนเงินให้กับรายการ fine_payment
 * - อัปโหลดรูปไปยัง bucket "media" (ชื่อไฟล์ slip-{timestamp}.{ext})
 * - อัปเดต slip_url + slip_uploaded_at ใน fine_payments
 * - ตรวจสอบว่าเป็นเจ้าของรายการ (user_id ตรงกัน)
 * - สถานะต้องเป็น "unpaid" (เลือกโอนแล้ว) หรือ "pending" (แนบใหม่) เท่านั้น
 *
 * formData: fine_id, slip (File)
 */
export async function uploadSlipAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireMember();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const fineId = String(formData.get("fine_id") ?? "").trim();
  if (!fineId) return { error: "ไม่พบ ID รายการชำระ" };

  const file = formData.get("slip") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "กรุณาเลือกไฟล์สลิป" };
  }

  // ตรวจสอบ MIME type
  if (!ALLOWED_SLIP_MIME.includes(file.type)) {
    return { error: "รองรับเฉพาะไฟล์ภาพ JPEG และ PNG เท่านั้น" };
  }

  // ตรวจสอบขนาดไฟล์
  if (file.size > MAX_SLIP_SIZE) {
    return { error: "ขนาดไฟล์ต้องไม่เกิน 2MB" };
  }

  // ตรวจสอบความเป็นเจ้าของรายการ + สถานะ (unpaid ที่เลือกโอน หรือ pending)
  const { data: finePayment, error: fetchErr } = await supabase
    .from("fine_payments")
    .select("id, user_id, status, payment_method")
    .eq("id", fineId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!finePayment) return { error: "ไม่พบรายการชำระ" };
  if ((finePayment as any).user_id !== auth.userId) {
    return { error: "คุณไม่มีสิทธิ์แก้ไขรายการนี้" };
  }
  const fpStatus = (finePayment as any).status as string;
  const fpMethod = (finePayment as any).payment_method as string | null;
  if (fpStatus === "counter_pending" || fpStatus === "approved" || fpStatus === "counter_paid") {
    return { error: "รายการนี้อยู่ในสถานะที่ไม่สามารถแนบสลิปได้" };
  }
  if (fpStatus === "unpaid" && fpMethod !== "transfer") {
    return { error: "กรุณาเลือกวิธีชำระเป็น \"โอนเงิน\" ก่อนแนบสลิป" };
  }

  // อัปโหลดไฟล์ไปยัง bucket "media"
  const ext = MIME_TO_EXT[file.type] ?? "jpg";
  const timestamp = Date.now();
  const filePath = `slip-${timestamp}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  // ดึง public URL
  const { data: publicUrlData } = supabase.storage
    .from("media")
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  // อัปเดต slip_url + slip_uploaded_at + ตั้งสถานะเป็น pending (รอตรวจสอบ)
  // - unpaid (ที่เลือกโอนแล้ว) → pending
  // - pending (แนบใหม่แทนสลิปเก่า) → pending
  // - rejected (สลิปเดิมไม่ผ่าน แนบใหม่) → pending
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("fine_payments")
    .update({
      slip_url: publicUrl,
      slip_uploaded_at: now,
      payment_method: "transfer",
      status: "pending",
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", fineId)
    .eq("user_id", auth.userId)
    .in("status", ["unpaid", "pending", "rejected"]);

  if (updateError) {
    // ถ้าอัปเดต DB ไม่สำเร็จ ลบไฟล์ที่เพิงอัปโหลด
    await supabase.storage.from("media").remove([filePath]);
    return { error: updateError.message };
  }

  revalidatePath("/member/fines");
  return { error: null };
}

// ---------- 4. choosePaymentMethodAction ----------
/**
 * สมาชิกเลือกวิธีชำระค่าปรับสำหรับรายการที่ยังไม่เลือก (status='unpaid')
 * - "transfer" → ยังคง unpaid แต่ตั้ง payment_method='transfer' (รอแนบสลิป)
 * - "counter"  → status='counter_pending' + payment_method='counter' (รอชำระเงินสดที่เคาน์เตอร์)
 *
 * formData: fine_id, method (transfer | counter)
 */
export async function choosePaymentMethodAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireMember();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const fineId = String(formData.get("fine_id") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  if (!fineId) return { error: "ไม่พบ ID รายการชำระ" };
  if (method !== "transfer" && method !== "counter")
    return { error: "วิธีชำระไม่ถูกต้อง" };

  // ตรวจความเป็นเจ้าของ + สถานะ unpaid
  const { data: finePayment, error: fetchErr } = await supabase
    .from("fine_payments")
    .select("id, user_id, status")
    .eq("id", fineId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!finePayment) return { error: "ไม่พบรายการชำระ" };
  if ((finePayment as any).user_id !== auth.userId) {
    return { error: "คุณไม่มีสิทธิ์แก้ไขรายการนี้" };
  }
  if ((finePayment as any).status !== "unpaid") {
    return { error: "รายการนี้เลือกวิธีชำระแล้ว ไม่สามารถเปลี่ยนได้" };
  }

  const updateData =
    method === "counter"
      ? { payment_method: "counter", status: "counter_pending" }
      : { payment_method: "transfer" };

  const { error: updateError } = await supabase
    .from("fine_payments")
    .update(updateData)
    .eq("id", fineId)
    .eq("user_id", auth.userId)
    .eq("status", "unpaid");

  if (updateError) return { error: updateError.message };

  revalidatePath("/member/fines");
  return { error: null };
}

// ---------- 4.5 cancelPaymentAction ----------
/**
 * สมาชิกยกเลิกการชำระเพื่อเลือกวิธีใหม่ (เผื่อกดผิด):
 *   - ลบสลิปที่แนบไว้ (ถ้ามี) ทั้งจาก storage และ DB
 *   - กลับเป็น status='unpaid' + payment_method=NULL (ยังไม่เลือกวิธี)
 * ใช้ได้จากสถานะ: unpaid (เลือกโอนไว้แล้ว), counter_pending, pending, rejected
 *
 * formData: fine_id
 */
export async function cancelPaymentAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireMember();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const fineId = String(formData.get("fine_id") ?? "").trim();
  if (!fineId) return { error: "ไม่พบ ID รายการชำระ" };

  // ตรวจความเป็นเจ้าของ + สถานะที่อนุญาตให้ยกเลิกได้
  const { data: finePayment, error: fetchErr } = await supabase
    .from("fine_payments")
    .select("id, user_id, status, slip_url")
    .eq("id", fineId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!finePayment) return { error: "ไม่พบรายการชำระ" };
  if ((finePayment as any).user_id !== auth.userId) {
    return { error: "คุณไม่มีสิทธิ์แก้ไขรายการนี้" };
  }

  const fpStatus = (finePayment as any).status as string;
  if (fpStatus === "approved" || fpStatus === "counter_paid") {
    return { error: "รายการนี้ชำระเงินแล้ว ไม่สามารถยกเลิกได้" };
  }

  // ลบสลิปเก่าจาก storage (ถ้ามี)
  const slipUrl = (finePayment as any).slip_url as string | null;
  if (slipUrl && slipUrl.includes("/media/")) {
    try {
      const url = new URL(slipUrl);
      const parts = url.pathname.split("/media/");
      if (parts.length > 1) {
        await supabase.storage.from("media").remove([parts[1]]);
      }
    } catch {
      // ไม่สำคัญ
    }
  }

  const { error: updateError } = await supabase
    .from("fine_payments")
    .update({
      status: "unpaid",
      payment_method: null,
      slip_url: null,
      slip_uploaded_at: null,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", fineId)
    .eq("user_id", auth.userId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/member/fines");
  return { error: null };
}

// ---------- 5. getFineBalanceAction ----------
/**
 * ดึงยอดค่าปรับคงค้างปัจจุบัน (fine_balance) ของสมาชิก
 */
export async function getFineBalanceAction(): Promise<ActionResult<number>> {
  const auth = await requireMember();
  if (!auth.ok) return { data: null, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("fine_balance")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "ไม่พบข้อมูลสมาชิก" };

  return { data: Number((data as any).fine_balance ?? 0), error: null };
}