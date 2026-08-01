"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /staff/fines (ตั้งค่าค่าปรับ + วิธีการชำระ + อนุมัติค่าปรับ)
 *
 * ตาราง:
 *   - public.fine_settings (row เดียว is_active=true)
 *   - public.payment_methods (QR code บัญชี)
 *   - public.fine_payments (การชำระค่าปรับ รออนุมัติ)
 *
 * Storage bucket: media (QR image)
 */

const MAX_QR_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_QR_MIME = ["image/jpeg", "image/png"];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

// ---------- Types ----------
export type FineSettings = {
  id: string;
  overdue_rate: number;
  overdue_max_days: number;
  damage_new_pct: number;
  damage_good_pct: number;
  damage_fair_pct: number;
  damage_poor_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
  account_name: string | null;
  account_number: string | null;
  qr_image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PendingFine = {
  id: string;
  user_id: string;
  borrow_record_id: string | null;
  fine_type: string;
  amount: number;
  description: string | null;
  payment_method: string;
  slip_url: string | null;
  slip_uploaded_at: string | null;
  status: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  user: {
    full_name: string;
    user_id_code: string;
  } | null;
  borrow_record: {
    id: string;
    due_date: string;
    returned_at: string | null;
    status: string;
    fine_amount: number;
    fine_reason: string | null;
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

// ---------- 1. getFineSettingsAction ----------
export async function getFineSettingsAction(): Promise<
  ActionResult<FineSettings>
> {
  const auth = await requireStaff();
  if (!auth.ok) return { data: null, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fine_settings")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: "ยังไม่มีการตั้งค่าค่าปรับ" };
  return { data: data as FineSettings, error: null };
}

// ---------- 2. updateFineSettingsAction ----------
export async function updateFineSettingsAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  const overdue_rate = parseFloat(String(formData.get("overdue_rate") ?? ""));
  const overdue_max_days = parseInt(
    String(formData.get("overdue_max_days") ?? ""),
    10,
  );
  const damage_new_pct = parseFloat(
    String(formData.get("damage_new_pct") ?? ""),
  );
  const damage_good_pct = parseFloat(
    String(formData.get("damage_good_pct") ?? ""),
  );
  const damage_fair_pct = parseFloat(
    String(formData.get("damage_fair_pct") ?? ""),
  );
  const damage_poor_pct = parseFloat(
    String(formData.get("damage_poor_pct") ?? ""),
  );

  if (isNaN(overdue_rate) || overdue_rate < 0)
    return { error: "อัตราค่าปรับล่าช้าไม่ถูกต้อง" };
  if (isNaN(overdue_max_days) || overdue_max_days < 0)
    return { error: "จำนวนวันสูงสุดไม่ถูกต้อง" };
  const pctChecks: [string, number][] = [
    ["มือหนึ่ง", damage_new_pct],
    ["สภาพดี", damage_good_pct],
    ["พอใช้", damage_fair_pct],
    ["ชำรุด", damage_poor_pct],
  ];
  for (const [label, val] of pctChecks) {
    if (isNaN(val) || val < 0 || val > 100)
      return { error: `เปอร์เซ็นต์ค่าปรับ (${label}) ต้องอยู่ระหว่าง 0-100` };
  }

  if (!id) {
    // ถ้ายังไม่มี row → insert ใหม่
    const { error } = await supabase
      .from("fine_settings")
      .insert({
        overdue_rate,
        overdue_max_days,
        damage_new_pct,
        damage_good_pct,
        damage_fair_pct,
        damage_poor_pct,
        is_active: true,
        updated_by: auth.userId,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/staff/fines");
    return { error: null };
  }

  const { error } = await supabase
    .from("fine_settings")
    .update({
      overdue_rate,
      overdue_max_days,
      damage_new_pct,
      damage_good_pct,
      damage_fair_pct,
      damage_poor_pct,
      updated_by: auth.userId,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/fines");
  return { error: null };
}

// ---------- 3. getPaymentMethodsAction ----------
export async function getPaymentMethodsAction(): Promise<
  ActionResult<PaymentMethod[]>
> {
  const auth = await requireStaff();
  if (!auth.ok) return { data: null, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: (data as PaymentMethod[]) ?? [], error: null };
}

// ---------- 4. createPaymentMethodAction ----------
export async function createPaymentMethodAction(
  formData: FormData,
): Promise<{ error: string | null; id: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error, id: null };
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const account_name = String(formData.get("account_name") ?? "").trim();
  const account_number = String(formData.get("account_number") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อบัญชี", id: null };

  // QR image upload (ถ้ามี)
  let qrImageUrl: string | null = null;
  const file = formData.get("qr_image") as File | null;
  if (file && file.size > 0) {
    const uploadRes = await uploadQrImage(file, supabase);
    if (uploadRes.error) return { error: uploadRes.error, id: null };
    qrImageUrl = uploadRes.url;
  }

  // sort_order สูงสุด + 1
  const { data: maxRow } = await supabase
    .from("payment_methods")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (Number(maxRow?.sort_order ?? -1)) + 1;

  const { data, error } = await supabase
    .from("payment_methods")
    .insert({
      name,
      account_name: account_name || null,
      account_number: account_number || null,
      qr_image_url: qrImageUrl,
      is_active: true,
      sort_order: nextSort,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };
  revalidatePath("/staff/fines");
  return { error: null, id: data.id };
}

// ---------- 5. updatePaymentMethodAction ----------
export async function updatePaymentMethodAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ไม่พบ ID" };
  const name = String(formData.get("name") ?? "").trim();
  const account_name = String(formData.get("account_name") ?? "").trim();
  const account_number = String(formData.get("account_number") ?? "").trim();
  if (!name) return { error: "กรุณากรอกชื่อบัญชี" };

  const updateData: Record<string, any> = {
    name,
    account_name: account_name || null,
    account_number: account_number || null,
  };

  // QR image upload (ถ้ามีไฟล์ใหม่)
  const file = formData.get("qr_image") as File | null;
  if (file && file.size > 0) {
    const uploadRes = await uploadQrImage(file, supabase);
    if (uploadRes.error) return { error: uploadRes.error };
    updateData.qr_image_url = uploadRes.url;

    // ลบ QR เก่าจาก storage (ถ้ามี)
    const { data: old } = await supabase
      .from("payment_methods")
      .select("qr_image_url")
      .eq("id", id)
      .maybeSingle();
    if (old?.qr_image_url) {
      await removeQrImage(old.qr_image_url, supabase);
    }
  }

  const { error } = await supabase
    .from("payment_methods")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/fines");
  return { error: null };
}

// ---------- 6. deletePaymentMethodAction ----------
export async function deletePaymentMethodAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ไม่พบ ID" };

  // ดึง qr_image_url เพื่อลบรูป
  const { data: method } = await supabase
    .from("payment_methods")
    .select("qr_image_url")
    .eq("id", id)
    .maybeSingle();

  if (method?.qr_image_url) {
    await removeQrImage(method.qr_image_url, supabase);
  }

  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/staff/fines");
  return { error: null };
}

// ---------- 7. getPendingFinesAction ----------
export async function getPendingFinesAction(): Promise<
  ActionResult<PendingFine[]>
> {
  const auth = await requireStaff();
  if (!auth.ok) return { data: null, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fine_payments")
    .select(
      `
      id, user_id, borrow_record_id, fine_type, amount, description,
      payment_method, slip_url, slip_uploaded_at, status, review_note,
      reviewed_by, reviewed_at, created_at, updated_at,
      users!fine_payments_user_id_fkey ( full_name, user_id_code ),
      borrow_records!fine_payments_borrow_record_id_fkey (
        id, due_date, returned_at, status, fine_amount, fine_reason
      )
      `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    borrow_record_id: r.borrow_record_id,
    fine_type: r.fine_type,
    amount: Number(r.amount ?? 0),
    description: r.description ?? null,
    payment_method: r.payment_method,
    slip_url: r.slip_url ?? null,
    slip_uploaded_at: r.slip_uploaded_at ?? null,
    status: r.status,
    review_note: r.review_note ?? null,
    reviewed_by: r.reviewed_by ?? null,
    reviewed_at: r.reviewed_at ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    user: r.users
      ? {
          full_name: r.users.full_name,
          user_id_code: r.users.user_id_code,
        }
      : null,
    borrow_record: r.borrow_records
      ? {
          id: r.borrow_records.id,
          due_date: r.borrow_records.due_date,
          returned_at: r.borrow_records.returned_at,
          status: r.borrow_records.status,
          fine_amount: Number(r.borrow_records.fine_amount ?? 0),
          fine_reason: r.borrow_records.fine_reason ?? null,
        }
      : null,
  })) as PendingFine[];

  return { data: rows, error: null };
}

// ---------- 8. approveFineAction ----------
export async function approveFineAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ไม่พบ ID รายการชำระ" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fine_payments")
    .update({
      status: "approved",
      reviewed_by: auth.userId,
      reviewed_at: now,
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return { error: error.message };

  // ถ้าเป็นการชำระค่าชดใช้หนังสือชำรุด → resolve รายการชำรุดให้อัตโนมัติ
  const { data: payment } = await supabase
    .from("fine_payments")
    .select("damaged_record_id")
    .eq("id", id)
    .maybeSingle();

  if (payment?.damaged_record_id) {
    const { error: damagedErr } = await supabase
      .from("damaged_records")
      .update({
        status: "paid",
        resolution_method: "payment",
        fine_payment_id: id,
        handled_by: auth.userId,
        updated_at: now,
      })
      .eq("id", payment.damaged_record_id)
      .eq("status", "unresolved");

    if (damagedErr) return { error: damagedErr.message };
  }

  revalidatePath("/staff/fines");
  revalidatePath("/staff/books/damaged");
  return { error: null };
}

// ---------- 9. rejectFineAction ----------
export async function rejectFineAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const auth = await requireStaff();
  if (!auth.ok) return { error: auth.error };
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "ไม่พบ ID รายการชำระ" };

  const review_note = String(formData.get("review_note") ?? "").trim();

  const { error } = await supabase
    .from("fine_payments")
    .update({
      status: "rejected",
      review_note: review_note || null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/staff/fines");
  return { error: null };
}

// ---------- helpers ----------
async function uploadQrImage(
  file: File,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ error: string | null; url: string | null }> {
  if (!ALLOWED_QR_MIME.includes(file.type)) {
    return { error: "รองรับเฉพาะ JPEG และ PNG", url: null };
  }
  if (file.size > MAX_QR_SIZE) {
    return { error: "ขนาดไฟล์ต้องไม่เกิน 2MB", url: null };
  }

  const ext = MIME_TO_EXT[file.type] ?? "jpg";
  const timestamp = Date.now();
  const filePath = `qr-${timestamp}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { error: uploadError.message, url: null };
  }

  const { data: publicUrlData } = supabase.storage
    .from("media")
    .getPublicUrl(filePath);

  return { error: null, url: publicUrlData.publicUrl };
}

async function removeQrImage(
  imageUrl: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  try {
    if (!imageUrl.includes("/media/")) return;
    const url = new URL(imageUrl);
    const parts = url.pathname.split("/media/");
    if (parts.length > 1) {
      const filePath = parts[1];
      await supabase.storage.from("media").remove([filePath]);
    }
  } catch {
    // ไม่สำคัญ
  }
}