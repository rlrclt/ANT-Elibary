"use server";

import { createClient } from "@/utils/supabase/server";
import { computeExpiry } from "@/utils/student-expiry";

/**
 * Server Actions สำหรับ /staff/groups (เจาะกลุ่มเรียน)
 * หน้าที่ใช้เลือกปีการศึกษา → แผนก → ระดับชั้น → รหัสกลุ่มเรียน
 * แล้วแสดงรายชื่อสมาชิกทั้งหมดในกลุ่มนั้น (เจาะลึกดูต่อได้ที่ /staff/members/[id])
 */

export type GroupMember = {
  id: string;
  user_id_code: string;
  full_name: string;
  email: string | null;
  department: string | null;
  class_level: string | null;
  room_level: string | null;
  class_number: string | null;
  role: "member" | "staff" | "admin";
  status: "active" | "suspended";
  gender: string | null;
  phone: string | null;
  avatar_url: string | null;
  fine_balance: number;
  borrow_limit: number;
  expired: boolean;
  expiry_date: string | null;
  days_remaining: number | null;
};

/** แปลงผลลัพธ์จาก Supabase เป็น GroupMember พร้อมคำนวณสถานะพ้นสภาพ */
function mapGroupMember(raw: any): GroupMember {
  const group = raw.dropdown_class_groups ?? null;
  const expiry = computeExpiry({
    start_date: group?.start_date,
    duration_years: group?.duration_years,
  });

  return {
    id: raw.id,
    user_id_code: raw.user_id_code,
    full_name: raw.full_name,
    email: raw.email,
    department: raw.department,
    class_level: raw.class_level,
    room_level: raw.room_level,
    class_number: raw.class_number,
    role: raw.role,
    status: raw.status,
    gender: raw.gender,
    phone: raw.phone,
    avatar_url: raw.avatar_url,
    fine_balance: Number(raw.fine_balance ?? 0),
    borrow_limit: raw.borrow_limit,
    expired: expiry.isExpired,
    expiry_date: expiry.expiryDate,
    days_remaining: expiry.daysRemaining,
  };
}

// ---------- 1. getGroupMembersAction ----------
/**
 * ดึงสมาชิกทั้งหมดในรหัสกลุ่มเรียนที่ระบุ (เฉพาะบทบาท member)
 * เรียงตาม user_id_code เพื่อให้ตรงกับลำดับบัญชีจริง
 */
export async function getGroupMembersAction(
  classGroupId: string,
): Promise<{ data: GroupMember[] | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "กรุณาเข้าสู่ระบบ" };

  if (!classGroupId.trim()) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, user_id_code, full_name, email, department, class_level, room_level, class_number, role, status, gender, phone, avatar_url, fine_balance, borrow_limit, dropdown_class_groups(start_date, duration_years)",
    )
    .eq("class_group_id", classGroupId)
    .eq("role", "member")
    .order("user_id_code", { ascending: true });

  if (error) return { data: null, error: error.message };

  return { data: (data ?? []).map(mapGroupMember), error: null };
}

// ---------- 2. getGroupInfoAction ----------
/**
 * ดึงข้อมูลสรุปของรหัสกลุ่มเรียน (รหัส ชื่อ ปีการศึกษา แผนก ระดับชั้น)
 * เพื่อแสดงเป็น breadcrumb สรุปบนหน้าหลังเลือกกลุ่มแล้ว
 */
export async function getGroupInfoAction(classGroupId: string): Promise<{
  data: {
    id: string;
    code: string;
    name: string | null;
    academic_year: string | null;
    department_id: string | null;
    class_level_id: string | null;
    department_name: string | null;
    class_level_name: string | null;
  } | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "กรุณาเข้าสู่ระบบ" };

  if (!classGroupId.trim()) return { data: null, error: null };

  const { data: group, error } = await supabase
    .from("dropdown_class_groups")
    .select("*")
    .eq("id", classGroupId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!group) return { data: null, error: "ไม่พบรหัสกลุ่มเรียน" };

  const [deptRes, levelRes] = await Promise.all([
    group.department_id
      ? supabase
          .from("dropdown_departments")
          .select("name")
          .eq("id", group.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    group.class_level_id
      ? supabase
          .from("dropdown_class_levels")
          .select("name")
          .eq("id", group.class_level_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    data: {
      id: group.id,
      code: group.code,
      name: group.name ?? null,
      academic_year: group.academic_year ?? null,
      department_id: group.department_id ?? null,
      class_level_id: group.class_level_id ?? null,
      department_name: deptRes.data?.name ?? null,
      class_level_name: levelRes.data?.name ?? null,
    },
    error: null,
  };
}
