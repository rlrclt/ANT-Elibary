"use server";

import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /member/profile
 * จัดการข้อมูลส่วนตัว, รหัสผ่าน, อีเมล และรีเซ็ตรหัสผ่าน
 * ใช้ server supabase client (cookie-based session)
 */

// ---------- Types ----------
export type ProfileData = {
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

// ---------- 1. updateProfileAction ----------
/**
 * อัปเดตข้อมูลส่วนตัวใน public.users ของผู้ใช้ปัจจุบัน
 * ฟิลด์ที่แก้ไขได้: full_name, phone, department, class_level, class_number, address, avatar_url
 */
export async function updateProfileAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง" };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "กรุณากรอกชื่อ-สกุล" };

  const profile: ProfileData = {
    full_name: fullName,
    phone: String(formData.get("phone") ?? "").trim(),
    department: String(formData.get("department") ?? "").trim(),
    class_level: String(formData.get("class_level") ?? "").trim(),
    class_number: String(formData.get("class_number") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    avatar_url: String(formData.get("avatar_url") ?? "").trim(),
  };

  const { error } = await supabase
    .from("users")
    .update({
      full_name: profile.full_name,
      phone: profile.phone || null,
      department: profile.department || null,
      class_level: profile.class_level || null,
      class_number: profile.class_number || null,
      address: profile.address || null,
      avatar_url: profile.avatar_url || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/member/profile");
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