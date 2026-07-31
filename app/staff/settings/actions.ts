"use server";

import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /staff/settings
 * จัดการข้อมูลเจ้าหน้าที่, รหัสผ่าน, อีเมล และรีเซ็ตรหัสผ่าน
 * ใช้ server supabase client (cookie-based session)
 */

// ---------- Types ----------
export type StaffProfileData = {
  full_name: string;
  phone: string;
  department: string;
  class_level: string;
  class_number: string;
  address: string;
  avatar_url: string;
};

/** ดึง origin ของ request ปัจจุบัน (เช่น http://localhost:3000) */
async function requestOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// ---------- 1. updateStaffProfileAction ----------
/**
 * อัปเดตข้อมูลเจ้าหน้าที่ใน public.users ของผู้ใช้ปัจจุบัน
 * ฟิลด์ที่แก้ไขได้: full_name, phone, department, class_level, class_number, address, avatar_url
 */
export async function updateStaffProfileAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง" };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "กรุณากรอกชื่อ-สกุล" };

  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();
  const classNumber = String(formData.get("class_number") ?? "").trim();

  const departmentId = String(formData.get("department_id") ?? "").trim() || null;
  const classLevelId = String(formData.get("class_level_id") ?? "").trim() || null;
  const roomLevelId = String(formData.get("room_level_id") ?? "").trim() || null;
  const classGroupId = String(formData.get("class_group_id") ?? "").trim() || null;

  const { error } = await supabase
    .from("users")
    .update({
      full_name: fullName,
      phone: phone || null,
      address: address || null,
      avatar_url: avatarUrl || null,
      class_number: classNumber || null,
      department_id: departmentId,
      class_level_id: classLevelId,
      room_level_id: roomLevelId,
      class_group_id: classGroupId,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/staff/settings");
  return { error: null };
}

// ---------- 2. changePasswordAction ----------
/**
 * เปลี่ยนรหัสผ่าน — ตรวจสอบรหัสผ่านปัจจุบันก่อน (signInWithPassword)
 * รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร และตรงกับยืนยันรหัสผ่าน
 */
export async function changePasswordAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง" };
  if (!user.email) return { error: "ไม่สามารถเปลี่ยนรหัสผ่านได้ เนื่องจากไม่มีอีเมลผูกกับบัญชี" };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  // ตรวจสอบรหัสผ่านปัจจุบัน
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };

  if (newPassword !== confirmPassword) {
    return { error: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" };
  }
  if (newPassword.length < 8) {
    return { error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) return { error: updateError.message };

  return { error: null };
}

// ---------- 3. changeEmailAction ----------
/**
 * เปลี่ยนอีเมล — ตรวจสอบรหัสผ่านปัจจุบันก่อน
 * Supabase จะส่งอีเมลยืนยันไปที่อีเมลใหม่ (ต้องคลิกลิงก์ก่อนจึงจะมีผล)
 */
export async function changeEmailAction(
  formData: FormData,
): Promise<{ error: string | null; pendingVerification: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง", pendingVerification: false };
  if (!user.email) return { error: "ไม่มีอีเมลผูกกับบัญชี", pendingVerification: false };

  const newEmail = String(formData.get("newEmail") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "");

  if (!newEmail) return { error: "กรุณากรอกอีเมลใหม่", pendingVerification: false };

  // ตรวจสอบรหัสผ่านปัจจุบัน
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง", pendingVerification: false };

  const { error: updateError } = await supabase.auth.updateUser({
    email: newEmail,
  });
  if (updateError) return { error: updateError.message, pendingVerification: false };

  // Supabase ส่งอีเมลยืนยันไปที่อีเมลใหม่ — ผู้ใช้ต้องคลิกลิงก์ก่อน
  return { error: null, pendingVerification: true };
}

// ---------- 4. sendPasswordResetAction ----------
/**
 * ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมล — สำหรับกรณีลืมรหัสผ่าน
 * Supabase ส่ง recovery LINK (ไม่ใช่ PIN) ไปยังอีเมล
 */
export async function sendPasswordResetAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();

  if (!email) return { error: "กรุณากรอกอีเมล" };

  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });
  if (error) return { error: error.message };

  return { error: null };
}