"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { computeExpiry } from "@/utils/student-expiry";

/**
 * Server Actions สำหรับ /staff/members
 * ทำงานฝั่ง server ผ่าน supabase admin (service_role)
 * จัดการข้อมูลสมาชิกใน public.users
 */

// ---------- Types ----------
export type User = {
  id: string;
  user_id_code: string;
  full_name: string;
  email: string | null;
  department: string | null;
  class_level: string | null;
  class_number: string | null;
  role: "member" | "staff" | "admin";
  status: "active" | "suspended";
  borrow_limit: number;
  fine_balance: number;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  created_at: string;
  user_type: string | null;
  department_id: string | null;
  class_level_id: string | null;
  room_level_id: string | null;
  room_level: string | null;
  class_group_id: string | null;
  class_group: string | null;
  gender: string | null;
  suspended_reason: string | null;
  suspended_at: string | null;
  suspended_by: string | null;
  // คำนวณแบบ virtual จาก dropdown_class_groups
  expired: boolean;
  expiry_date: string | null;
  days_remaining: number | null;
};

export type UserStats = {
  total: number;
  members: number;
  staff: number;
  suspended: number;
};

type MemberFilters = {
  search?: string;
  role?: "all" | "member" | "staff" | "admin";
  status?: "all" | "active" | "suspended" | "expired";
  academicYear?: string;
  departmentId?: string;
  classLevelId?: string;
  classGroupId?: string;
};

/** แปลงผลลัพธ์จาก Supabase เป็น User พร้อมคำนวณสถานะพ้นสภาพ */
function mapUser(raw: any): User {
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
    class_number: raw.class_number,
    role: raw.role,
    status: raw.status,
    borrow_limit: raw.borrow_limit,
    fine_balance: Number(raw.fine_balance ?? 0),
    phone: raw.phone,
    avatar_url: raw.avatar_url,
    address: raw.address,
    created_at: raw.created_at,
    user_type: raw.user_type,
    department_id: raw.department_id,
    class_level_id: raw.class_level_id,
    room_level_id: raw.room_level_id,
    room_level: raw.room_level,
    class_group_id: raw.class_group_id,
    class_group: raw.class_group,
    gender: raw.gender,
    suspended_reason: raw.suspended_reason ?? null,
    suspended_at: raw.suspended_at ?? null,
    suspended_by: raw.suspended_by ?? null,
    expired: expiry.isExpired,
    expiry_date: expiry.expiryDate,
    days_remaining: expiry.daysRemaining,
  };
}

// ---------- 1. getMembersAction ----------
export async function getMembersAction(filters?: MemberFilters): Promise<{
  data: User[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  let query = supabase
    .from("users")
    .select(
      "id, user_id_code, full_name, email, department, class_level, class_number, role, status, borrow_limit, fine_balance, phone, avatar_url, address, created_at, user_type, department_id, class_level_id, room_level_id, room_level, class_group_id, class_group, gender, suspended_reason, suspended_at, suspended_by, dropdown_class_groups(start_date, duration_years)",
    )
    .order("created_at", { ascending: false });

  if (filters?.search) {
    const s = filters.search.trim();
    query = query.or(
      `full_name.ilike.%${s}%,email.ilike.%${s}%,user_id_code.ilike.%${s}%`,
    );
  }
  if (filters?.role && filters.role !== "all") {
    query = query.eq("role", filters.role);
  }
  if (filters?.status && filters.status !== "all" && filters.status !== "expired") {
    query = query.eq("status", filters.status);
  }
  // ตัวกรองลดหลั่น: ปีการศึกษา → แผนก → ระดับชั้น → รหัสกลุ่มเรียน
  if (filters?.academicYear) {
    query = query.eq("dropdown_class_groups.academic_year", filters.academicYear);
  }
  if (filters?.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }
  if (filters?.classLevelId) {
    query = query.eq("class_level_id", filters.classLevelId);
  }
  if (filters?.classGroupId) {
    query = query.eq("class_group_id", filters.classGroupId);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };

  let users = (data ?? []).map(mapUser);

  // "พ้นสภาพ" เป็นสถานะคำนวณแบบ virtual → กรองฝั่ง TS
  if (filters?.status === "expired") {
    users = users.filter((u) => u.expired);
  }

  return { data: users, error: null };
}

// ---------- 2. getMemberStatsAction ----------
export async function getMemberStatsAction(): Promise<{
  data: UserStats;
  error: string | null;
}> {
  const supabase = await createClient();
  const [
    { count: total },
    { count: members },
    { count: staff },
    { count: suspended },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "member"),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .in("role", ["staff", "admin"]),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("status", "suspended"),
  ]);

  return {
    data: {
      total: total ?? 0,
      members: members ?? 0,
      staff: staff ?? 0,
      suspended: suspended ?? 0,
    },
    error: null,
  };
}

// ---------- 3. updateMemberAction ----------
export async function updateMemberAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const adminClient = createAdminClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID สมาชิก" };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "กรุณากรอกชื่อ-สกุล" };

  const email = String(formData.get("email") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "member") as "member" | "staff" | "admin";
  // สถานะจากฟอร์ม (select ถูก disabled ใน drawer → จะไม่มีค่า = ให้คงสถานะเดิม)
  const submittedStatus = String(formData.get("status") ?? "").trim() as "active" | "suspended" | "";
  const borrowLimit = parseInt(String(formData.get("borrow_limit") ?? "5"), 10);
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim() || null;
  const newPassword = String(formData.get("new_password") ?? "");

  const userType = String(formData.get("user_type") ?? "student").trim();
  const departmentId = String(formData.get("department_id") ?? "").trim() || null;
  const classLevelId = String(formData.get("class_level_id") ?? "").trim() || null;
  const roomLevelId = String(formData.get("room_level_id") ?? "").trim() || null;
  const classGroupId = String(formData.get("class_group_id") ?? "").trim() || null;
  const classNumber = String(formData.get("class_number") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "not_specified").trim();

  // 1. ดึงข้อมูลเดิมเพื่อตรวจสอบการเปลี่ยนแปลง + เก็บสถานะปัจจุบัน
  const { data: oldUser, error: fetchError } = await adminClient
    .from("users")
    .select("email, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !oldUser) {
    return { error: "ไม่พบข้อมูลสมาชิก" };
  }

  // ถ้าฟอร์มไม่ส่งสถานะมา (disabled) ให้คงสถานะเดิมไว้
  const status: "active" | "suspended" =
    submittedStatus || (oldUser.status as "active" | "suspended");

  // 2. ถ้ามีการเปลี่ยนอีเมล ตรวจสอบว่าซ้ำกับผู้อื่นหรือไม่
  if (email && email !== oldUser.email) {
    const { data: existingEmail } = await adminClient
      .from("users")
      .select("id")
      .eq("email", email)
      .neq("id", id)
      .maybeSingle();

    if (existingEmail) {
      return { error: "อีเมลนี้มีผู้ใช้งานอื่นใช้อยู่แล้ว" };
    }

    // อัปเดตอีเมลใน Auth
    const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
      email: email,
      email_confirm: true,
    });

    if (authError) {
      return { error: `ไม่สามารถอัปเดตอีเมลในระบบ Auth ได้: ${authError.message}` };
    }
  }

  // 3. อัปเดตฟิลด์อื่นๆ ใน Auth (รวมถึงรหัสผ่านใหม่ถ้ามี)
  const authUpdateData: any = {
    user_metadata: {
      full_name: fullName,
      phone,
      role,
      gender,
    },
  };

  if (newPassword) {
    if (newPassword.length < 8) {
      return { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" };
    }
    authUpdateData.password = newPassword;
  }

  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(id, authUpdateData);
  if (authUpdateError) {
    return { error: `ไม่สามารถอัปเดตข้อมูลบัญชีผู้ใช้ได้: ${authUpdateError.message}` };
  }

  // 4. อัปเดตตาราง public.users
  const updateData: any = {
    full_name: fullName,
    email,
    role,
    borrow_limit: isNaN(borrowLimit) ? 5 : borrowLimit,
    phone,
    address,
    avatar_url: avatarUrl,
    user_type: userType,
    department_id: departmentId,
    class_level_id: classLevelId,
    room_level_id: roomLevelId,
    class_group_id: classGroupId,
    class_number: classNumber,
    gender,
  };

  // ซิงก์ข้อมูลการระงับตามสถานะที่ส่งมา
  const suspendReason = String(formData.get("suspended_reason") ?? "").trim() || null;
  if (status === "suspended") {
    updateData.status = "suspended";
    if (suspendReason) {
      const {
        data: { user: me },
      } = await adminClient.auth.getUser();
      updateData.suspended_reason = suspendReason;
      updateData.suspended_at = new Date().toISOString();
      updateData.suspended_by = me?.id ?? null;
    }
  } else if (status === "active") {
    updateData.status = "active";
    updateData.suspended_reason = null;
    updateData.suspended_at = null;
    updateData.suspended_by = null;
  }

  const { error } = await adminClient
    .from("users")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/members");
  return { error: null };
}

// ---------- 4. suspendMemberAction ----------
/**
 * ระงับบัญชีสมาชิก (ต้องระบุเหตุผล)
 * บันทึก suspended_at + suspended_by ไว้เป็น audit trail
 */
export async function suspendMemberAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const adminClient = createAdminClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID สมาชิก" };

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "กรุณาระบุเหตุผลการระงับ" };

  const {
    data: { user: me },
  } = await adminClient.auth.getUser();

  const { error } = await adminClient
    .from("users")
    .update({
      status: "suspended",
      suspended_reason: reason,
      suspended_at: new Date().toISOString(),
      suspended_by: me?.id ?? null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/members");
  return { error: null };
}

// ---------- 5. activateMemberAction ----------
export async function activateMemberAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const adminClient = createAdminClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID สมาชิก" };

  const { error } = await adminClient
    .from("users")
    .update({
      status: "active",
      suspended_reason: null,
      suspended_at: null,
      suspended_by: null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/members");
  return { error: null };
}

// ---------- 5.5 suspendMembersByGroupAction ----------
/**
 * ระงับสมาชิกทั้งกลุ่มเรียน (ตาม class_group_id)
 * ใช้กับสมาชิกที่ "พ้นสภาพ" — admin กดระงับทีละกลุ่มได้
 */
export async function suspendMembersByGroupAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const adminClient = createAdminClient();
  const classGroupId = String(formData.get("class_group_id") ?? "").trim();
  if (!classGroupId) return { error: "ไม่พบรหัสกลุ่มเรียน" };

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "กรุณาระบุเหตุผลการระงับ" };

  const {
    data: { user: me },
  } = await adminClient.auth.getUser();

  const { error } = await adminClient
    .from("users")
    .update({
      status: "suspended",
      suspended_reason: reason,
      suspended_at: new Date().toISOString(),
      suspended_by: me?.id ?? null,
    })
    .eq("class_group_id", classGroupId)
    .eq("role", "member")
    .eq("status", "active");

  if (error) return { error: error.message };
  revalidatePath("/staff/members");
  return { error: null };
}

// ---------- 6. createMemberAction ----------
export async function createMemberAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const adminClient = createAdminClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const userIdCode = String(formData.get("user_id_code") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "member") as "member" | "staff" | "admin";
  const status = String(formData.get("status") ?? "active") as "active" | "suspended";
  const borrowLimit = parseInt(String(formData.get("borrow_limit") ?? "5"), 10);
  const address = String(formData.get("address") ?? "").trim() || null;
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim() || null;

  const userType = String(formData.get("user_type") ?? "student").trim();
  const departmentId = String(formData.get("department_id") ?? "").trim() || null;
  const classLevelId = String(formData.get("class_level_id") ?? "").trim() || null;
  const roomLevelId = String(formData.get("room_level_id") ?? "").trim() || null;
  const classGroupId = String(formData.get("class_group_id") ?? "").trim() || null;
  const classNumber = String(formData.get("class_number") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "not_specified").trim();

  if (!fullName) return { error: "กรุณากรอกชื่อ-สกุล" };
  if (!email) return { error: "กรุณากรอกอีเมล" };
  if (!password) return { error: "กรุณากรอกรหัสผ่าน" };
  if (password.length < 8) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };

  // ตรวจสอบรหัสสมาชิกซ้ำ
  if (userIdCode) {
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("user_id_code", userIdCode)
      .maybeSingle();
    if (existingUser) {
      return { error: "รหัสสมาชิกนี้มีผู้ใช้งานแล้ว" };
    }
  }

  // ตรวจสอบอีเมลซ้ำ
  const { data: existingEmail } = await adminClient
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingEmail) {
    return { error: "อีเมลนี้มีผู้ใช้งานแล้ว" };
  }

  // สร้างบัญชีผู้ใช้ใน Auth ด้วย Admin API
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      user_id_code: userIdCode,
      role,
      user_type: userType,
      department_id: departmentId,
      class_level_id: classLevelId,
      room_level_id: roomLevelId,
      class_group_id: classGroupId,
      gender,
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "ไม่สามารถสร้างบัญชีผู้ใช้ได้" };

  // อัปเดตข้อมูลเพิ่มเติมใน public.users
  const { error: updateError } = await adminClient
    .from("users")
    .update({
      status,
      borrow_limit: isNaN(borrowLimit) ? 5 : borrowLimit,
      address,
      avatar_url: avatarUrl,
      class_number: classNumber,
      user_type: userType,
      department_id: departmentId,
      class_level_id: classLevelId,
      room_level_id: roomLevelId,
      class_group_id: classGroupId,
      gender,
    })
    .eq("id", data.user.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/staff/members");
  return { error: null };
}