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
};

type ActiveLog = { id: string; check_in_at: string };

// ---------- 1. getMyActiveLogAction ----------
/**
 * ดึง log ที่ยัง active ของสมาชิก (check_out_at IS NULL)
 * ใช้แสดงสถานะ "คุณอยู่ในห้องสมุด"
 */
export async function getMyActiveLogAction(): Promise<{
  data: ActiveLog | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "กรุณาเข้าสู่ระบบ" };

  const { data, error } = await supabase
    .from("room_access_logs")
    .select("id, check_in_at")
    .eq("user_id", user.id)
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .maybeSingle();

  if (error) return { data: null, error: error.message };

  return { data: data as ActiveLog | null, error: null };
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
    .select("id, check_in_at, check_out_at, purpose")
    .eq("user_id", user.id)
    .order("check_in_at", { ascending: false })
    .limit(20);

  if (error) return { data: [], error: error.message };

  const logs: AccessLog[] = (data ?? []).map((r: any) => ({
    id: r.id,
    check_in_at: r.check_in_at,
    check_out_at: r.check_out_at ?? null,
    purpose: r.purpose ?? "อ่านหนังสือ",
  }));

  return { data: logs, error: null };
}

// ---------- 3. checkInAction ----------
/**
 * สมาชิกเช็คอินเข้าห้องสมุด — INSERT room_access_logs
 * ตรวจก่อนว่ามี active log อยู่แล้วหรือไม่ (กัน double check-in)
 */
export async function checkInAction(): Promise<{
  error: string | null;
  logId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", logId: null };

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
      purpose: "อ่านหนังสือ",
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