"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

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
  status?: "all" | "active" | "suspended";
};

// ---------- 1. getMembersAction ----------
export async function getMembersAction(filters?: MemberFilters): Promise<{
  data: User[] | null;
  error: string | null;
}> {
  const supabase = await createClient();
  let query = supabase
    .from("users")
    .select(
      "id, user_id_code, full_name, email, department, class_level, class_number, role, status, borrow_limit, fine_balance, phone, avatar_url, address, created_at",
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
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: data as User[], error: null };
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
  const department = String(formData.get("department") ?? "").trim() || null;
  const classLevel = String(formData.get("class_level") ?? "").trim() || null;
  const classNumber = String(formData.get("class_number") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "member") as "member" | "staff" | "admin";
  const status = String(formData.get("status") ?? "active") as "active" | "suspended";
  const borrowLimit = parseInt(String(formData.get("borrow_limit") ?? "5"), 10);
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim() || null;
  const newPassword = String(formData.get("new_password") ?? "");

  // 1. ดึงข้อมูลเดิมเพื่อตรวจสอบการเปลี่ยนแปลง
  const { data: oldUser, error: fetchError } = await adminClient
    .from("users")
    .select("email")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !oldUser) {
    return { error: "ไม่พบข้อมูลสมาชิก" };
  }

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
  const { error } = await adminClient
    .from("users")
    .update({
      full_name: fullName,
      email,
      department,
      class_level: classLevel,
      class_number: classNumber,
      role,
      status,
      borrow_limit: isNaN(borrowLimit) ? 5 : borrowLimit,
      phone,
      address,
      avatar_url: avatarUrl,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/members");
  return { error: null };
}

// ---------- 4. suspendMemberAction ----------
export async function suspendMemberAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID สมาชิก" };

  const { error } = await supabase
    .from("users")
    .update({ status: "suspended" })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/members");
  return { error: null };
}

// ---------- 5. activateMemberAction ----------
export async function activateMemberAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID สมาชิก" };

  const { error } = await supabase
    .from("users")
    .update({ status: "active" })
    .eq("id", id);

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
  const department = String(formData.get("department") ?? "").trim() || null;
  const classLevel = String(formData.get("class_level") ?? "").trim() || null;
  const classNumber = String(formData.get("class_number") ?? "").trim() || null;
  const borrowLimit = parseInt(String(formData.get("borrow_limit") ?? "5"), 10);
  const address = String(formData.get("address") ?? "").trim() || null;
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim() || null;

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
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "ไม่สามารถสร้างบัญชีผู้ใช้ได้" };

  // อัปเดตข้อมูลเพิ่มเติมใน public.users
  const { error: updateError } = await adminClient
    .from("users")
    .update({
      status,
      department,
      class_level: classLevel,
      class_number: classNumber,
      borrow_limit: isNaN(borrowLimit) ? 5 : borrowLimit,
      address,
      avatar_url: avatarUrl,
    })
    .eq("id", data.user.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/staff/members");
  return { error: null };
}