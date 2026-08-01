"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /member/access (ระบบเช็คอิน/เช็คเอาท์ห้องสมุดของสมาชิก)
 * ใช้ session ของสมาชิกที่ล็อกอินอยู่ ไม่ต้องส่ง user_id มาจาก client
 * จัดการ room_access_logs
 */

// ---------- Types ----------
export type AccessLog = {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  purpose: string;
  note: string | null;
};

type ActiveLog = { id: string; check_in_at: string; purpose: string; note: string | null };

// ---------- 0. autoCloseExpiredSessions ----------
/**
 * ปิด session ที่ member ลืมเช็คเอาท์ (เกินเวลาปิดห้องสมุด) แบบ lazy
 * ใช้ SECURITY DEFINER function บน DB เพื่อข้าม RLS
 * ถ้าเรียกไม่สำเร็จ (เช่น ยังไม่รัน migration) ให้ปล่อยผ่านเงียบ ๆ
 */
async function runAutoCloseSessions() {
  const supabase = await createClient();
  try {
    await supabase.rpc("auto_close_expired_sessions");
  } catch {
    // best-effort — ปล่อยผ่านถ้า feature ยังไม่พร้อม
  }
}

// ---------- 1. getMyActiveLogAction ----------
/**
 * ดึง log ที่ยัง active ของสมาชิก (check_out_at IS NULL)
 * ใช้แสดงสถานะ "คุณอยู่ในห้องสมุด"
 */
export async function getMyActiveLogAction(): Promise<{
  data: ActiveLog | null;
  error: string | null;
}> {
  // ปิด session ที่เกินเวลาก่อน (ถ้าเพิ่งกลับมาหน้าเพจ)
  await runAutoCloseSessions();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "กรุณาเข้าสู่ระบบ" };

  const { data, error } = await supabase
    .from("room_access_logs")
    .select("id, check_in_at, purpose, note")
    .eq("user_id", user.id)
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .maybeSingle();

  if (error) return { data: null, error: error.message };

  const active = data as any;
  return {
    data: active
      ? {
          id: active.id,
          check_in_at: active.check_in_at,
          purpose: active.purpose ?? "อ่านหนังสือ",
          note: active.note ?? null,
        }
      : null,
    error: null,
  };
}

// ---------- 2. getMyAccessHistoryAction ----------
/**
 * ดึงประวัติการเข้าใช้ห้องสมุดของสมาชิก (รวมที่เช็คเอาท์แล้ว)
 * เรียงตามวันที่เข้า ล่าสุดก่อน จำกัด 20 รายการ
 */
export async function getMyAccessHistoryAction(): Promise<{
  data: AccessLog[];
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "กรุณาเข้าสู่ระบบ" };

  const { data, error } = await supabase
    .from("room_access_logs")
    .select("id, check_in_at, check_out_at, purpose, note")
    .eq("user_id", user.id)
    .order("check_in_at", { ascending: false })
    .limit(20);

  if (error) return { data: [], error: error.message };

  const logs: AccessLog[] = (data ?? []).map((r: any) => ({
    id: r.id,
    check_in_at: r.check_in_at,
    check_out_at: r.check_out_at ?? null,
    purpose: r.purpose ?? "อ่านหนังสือ",
    note: r.note ?? null,
  }));

  return { data: logs, error: null };
}

// ---------- 2.5 getAccessPurposesAction ----------
/**
 * ดึงรายการวัตถุประสงค์การเข้าใช้ที่เปิดใช้งานอยู่
 * ให้ member เลือกตอนเช็คอิน (จาก dropdown_access_purposes)
 */
export async function getAccessPurposesAction(): Promise<{
  data: string[];
  error: string | null;
}> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("dropdown_access_purposes")
      .select("name")
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []).map((r: any) => r.name), error: null };
  } catch {
    // ตารางยังไม่มี (ยังไม่รัน migration) → ใช้ค่า default
    return { data: ["อ่านหนังสือ", "ยืม/คืนหนังสือ", "ศึกษาค้นคว้า"], error: null };
  }
}

// ---------- 2.6 getTodayLibraryHoursAction ----------
/**
 * ดึงเวลาเปิด-ปิดห้องสมุดของวันนี้ (จาก library_hours)
 * คืนเป็น string แสดงผล เช่น "08:00 - 17:00" หรือ null ถ้าวันนี้ปิดทำการ
 */
export async function getTodayLibraryHoursAction(): Promise<{
  data: { openTime: string; closeTime: string; isOpen: boolean } | null;
  error: string | null;
}> {
  const supabase = await createClient();
  // ISODOW: 1=จันทร์ ... 7=อาทิตย์
  const day = new Date().getDay() === 0 ? 7 : new Date().getDay();
  try {
    const { data, error } = await supabase
      .from("library_hours")
      .select("open_time, close_time, is_open")
      .eq("day_of_week", day)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };
    const toHHmm = (t: string) => t.slice(0, 5);
    return {
      data: {
        openTime: toHHmm(data.open_time),
        closeTime: toHHmm(data.close_time),
        isOpen: data.is_open,
      },
      error: null,
    };
  } catch {
    // ตารางยังไม่มี (ยังไม่รัน migration) → ไม่แสดงเวลาทำการ
    return { data: null, error: null };
  }
}

// ---------- 3. checkInAction ----------
/**
 * สมาชิกเช็คอินเข้าห้องสมุด — INSERT room_access_logs
 * ตรวจก่อนว่ามี active log อยู่แล้วหรือไม่ (กัน double check-in)
 * รับ purpose (มาทำอะไร) ที่ member เลือกจาก dropdown
 */
export async function checkInAction(
  formData: FormData,
): Promise<{
  error: string | null;
  logId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", logId: null };

  const purpose = String(formData.get("purpose") ?? "อ่านหนังสือ").trim() || "อ่านหนังสือ";

  // ตรวจสถานะสมาชิก — บัญชีที่ถูกระงับ/ไม่ active จะเช็คอินไม่ได้
  const { data: member, error: mErr } = await supabase
    .from("users")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (mErr) return { error: mErr.message, logId: null };
  if (!member) return { error: "ไม่พบข้อมูลสมาชิก", logId: null };
  if (member.status !== "active") {
    return {
      error:
        member.status === "suspended"
          ? "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่ห้องสมุด"
          : "บัญชีไม่อยู่ในสถานะใช้งาน ไม่สามารถเช็คอินได้",
      logId: null,
    };
  }

  // ตรวจว่ามี active log อยู่แล้ว (กัน double check-in)
  const { data: existing } = await supabase
    .from("room_access_logs")
    .select("id")
    .eq("user_id", user.id)
    .is("check_out_at", null)
    .maybeSingle();

  if (existing) {
    return { error: "คุณเช็คอินอยู่แล้ว กรุณาเช็คเอาท์ก่อน", logId: null };
  }

  // INSERT log ใหม่
  const { data: log, error: insertErr } = await supabase
    .from("room_access_logs")
    .insert({
      user_id: user.id,
      check_in_at: new Date().toISOString(),
      purpose,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message, logId: null };
  if (!log) return { error: "ไม่สามารถบันทึกการเข้าใช้ได้", logId: null };

  revalidatePath("/member/access");
  return { error: null, logId: log.id };
}

// ---------- 4. checkOutAction ----------
/**
 * สมาชิกเช็คเอาท์ออกจากห้องสมุด — UPDATE check_out_at = now()
 * ต้องเป็นเจ้าของ log และ check_out_at ต้องเป็น NULL
 */
export async function checkOutAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const logId = String(formData.get("logId") ?? "").trim();
  if (!logId) return { error: "ไม่พบ ID รายการเข้าใช้" };

  const { error: updErr } = await supabase
    .from("room_access_logs")
    .update({ check_out_at: new Date().toISOString() })
    .eq("id", logId)
    .eq("user_id", user.id)
    .is("check_out_at", null);

  if (updErr) return { error: updErr.message };

  revalidatePath("/member/access");
  return { error: null };
}