"use server";

import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * ดึง origin ของ request ปัจจุบัน (เช่น http://localhost:3000)
 * ใช้สำหรับ emailRedirectTo ใน auth.signUp
 */
async function requestOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Auth Server Actions — ใช้ @supabase/ssr server client
 * ทำงานฝั่ง server เท่านั้น, cookies จัดการ session อัตโนมัติ
 */

export type RegisterState = {
  error?: string;
};

/**
 * สมัครสมาชิก — ฟอร์มเก็บแค่ full_name, email, phone, password
 * - รหัสผ่านส่งให้ supabase.auth.signUp ซึ่งเก็บที่ auth.users (เข้ารหัสโดย Supabase)
 * - ส่ง full_name + phone ผ่าน options.data (metadata) ให้ trigger handle_new_auth_user
 *   ไปสร้างแถวใน public.users ให้อัตโนมัติ
 * - role ไม่ส่ง → trigger ใช้ default 'member'
 */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !email || !password) {
    return { error: "กรุณากรอกข้อมูลให้ครบ" };
  }
  if (password.length < 8) {
    return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }
  if (password !== confirmPassword) {
    return { error: "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
      data: {
        full_name: fullName,
        phone: phone || null,
      },
    },
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  // ถ้า Supabase เปิด email confirmation → redirect ไปหน้าแจ้งเช็คอีเมล
  // ถ้าปิด → session จะ active ทันที redirect ไปหน้า dashboard
  revalidatePath("/", "layout");
  redirect("/login?registered=1");
}

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  // ดึง role จาก public.users เพื่อ redirect ตามบทบาท
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "member";
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role) role = profile.role;
  }

  revalidatePath("/", "layout");
  // staff/admin → /staff, member → /member
  if (role === "staff" || role === "admin") {
    redirect("/staff");
  }
  redirect("/member");
}

/** แปล error message ของ Supabase Auth เป็นไทย */
function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("user already registered")) return "อีเมลนี้ถูกใช้สมัครแล้ว";
  if (m.includes("password should be at least"))
    return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
  if (m.includes("email not confirmed"))
    return "ยังไม่ได้ยืนยันอีเมล — กรุณาตรวจกล่องอีเมลของคุณ";
  return msg;
}