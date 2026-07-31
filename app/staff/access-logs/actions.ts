"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /staff/access-logs (การเข้าใช้ห้องสมุด)
 * จัดการ room_access_logs + join users
 */

// ---------- Types ----------
export type AccessLogWithUser = {
  id: string;
  user_id: string | null;
  check_in_at: string;
  check_out_at: string | null;
  purpose: string;
  user: { full_name: string; user_id_code: string } | null;
};

export type AccessStats = {
  currentlyIn: number;
  todayCount: number;
  monthCount: number;
  avgDurationMin: number;
};

type ActionResult<T> = { data: T | null; error: string | null };

// ---------- 1. getAccessLogsAction ----------
export async function getAccessLogsAction(filters?: {
  search?: string;
  status?: "all" | "inside" | "checked_out";
  dateFrom?: string;
  dateTo?: string;
}): Promise<ActionResult<AccessLogWithUser[]>> {
  const supabase = await createClient();

  // คิวรี room_access_logs + LEFT JOIN users ผ่านความสัมพันธ์ FK
  let query = supabase
    .from("room_access_logs")
    .select("*, users(full_name, user_id_code)")
    .order("check_in_at", { ascending: false })
    .limit(100);

  // กรองตามสถานะ
  if (filters?.status === "inside") {
    query = query.is("check_out_at", null);
  } else if (filters?.status === "checked_out") {
    query = query.not("check_out_at", "is", null);
  }

  // กรองตามช่วงวันที่เข้า
  if (filters?.dateFrom) {
    query = query.gte("check_in_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("check_in_at", filters.dateTo);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };

  // แมปข้อมูลให้ตรด type
  let logs: AccessLogWithUser[] = (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id ?? null,
    check_in_at: r.check_in_at,
    check_out_at: r.check_out_at ?? null,
    purpose: r.purpose ?? "อ่านหนังสือ",
    user: r.users
      ? {
          full_name: r.users.full_name,
          user_id_code: r.users.user_id_code,
        }
      : null,
  }));

  // คัดกรองด้วย search (ชื่อ/รหัสสมาชิก) ฝั่ง JS เพราะ join ลึกเกินไปสำหรับ or()
  if (filters?.search) {
    const s = filters.search.trim().toLowerCase();
    logs = logs.filter((l) => {
      const name = l.user?.full_name?.toLowerCase() ?? "";
      const code = l.user?.user_id_code?.toLowerCase() ?? "";
      return name.includes(s) || code.includes(s);
    });
  }

  return { data: logs, error: null };
}

// ---------- 2. getAccessStatsAction ----------
export async function getAccessStatsAction(): Promise<{
  data: AccessStats;
  error: string | null;
}> {
  const supabase = await createClient();

  // วันนี้เริ่มต้น 00:00 ตามเวลาท้องถิ่น
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  // วันแรกของเดือน
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  // (a) นับคนที่ยังอยู่ในห้องสมุด
  const [{ count: currentlyIn }, { count: todayCount }, { count: monthCount }] =
    await Promise.all([
      supabase
        .from("room_access_logs")
        .select("*", { count: "exact", head: true })
        .is("check_out_at", null),
      supabase
        .from("room_access_logs")
        .select("*", { count: "exact", head: true })
        .gte("check_in_at", startOfToday),
      supabase
        .from("room_access_logs")
        .select("*", { count: "exact", head: true })
        .gte("check_in_at", startOfMonth),
    ]);

  // (b) คำนวณระยะเวลาเฉลี่ย (นาที) สำหรับ log ที่เช็คเอาท์แล้ว
  const { data: closedLogs } = await supabase
    .from("room_access_logs")
    .select("check_in_at, check_out_at")
    .not("check_out_at", "is", null)
    .gte("check_in_at", startOfMonth);

  let avgDurationMin = 0;
  if (closedLogs && closedLogs.length > 0) {
    const totalMin = closedLogs.reduce((sum: number, r: any) => {
      const inAt = new Date(r.check_in_at).getTime();
      const outAt = new Date(r.check_out_at).getTime();
      const diffMin = (outAt - inAt) / 60000;
      return sum + (diffMin > 0 ? diffMin : 0);
    }, 0);
    avgDurationMin = Math.round(totalMin / closedLogs.length);
  }

  return {
    data: {
      currentlyIn: currentlyIn ?? 0,
      todayCount: todayCount ?? 0,
      monthCount: monthCount ?? 0,
      avgDurationMin,
    },
    error: null,
  };
}

// ---------- 3. manualCheckOutAction ----------
/**
 * เจ้าหน้าที่เช็คเอาท์แทนสมาชิก — UPDATE check_out_at = now()
 * ต้องเป็น log ที่ยังไม่เช็คเอาท์ (check_out_at IS NULL)
 */
export async function manualCheckOutAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const logId = String(formData.get("logId") ?? "").trim();
  if (!logId) return { error: "ไม่พบ ID รายการเข้าใช้" };

  // UPDATE เฉพาะ log ที่ยังไม่เช็คเอาท์
  const { error: updErr } = await supabase
    .from("room_access_logs")
    .update({ check_out_at: new Date().toISOString() })
    .eq("id", logId)
    .is("check_out_at", null);

  if (updErr) return { error: updErr.message };

  revalidatePath("/staff/access-logs");
  return { error: null };
}