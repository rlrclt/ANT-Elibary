"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

/**
 * Server Actions สำหรับ LINE integration
 * - createLineLinkToken: สร้าง token สำหรับเชื่อมบัญชี (LIFF → เว็บ)
 * - claimLineLinkToken: user ที่ login เว็บแล้วกดเชื่อม → บันทึก line_user_id
 * - unlinkLineAccount: ยกเลิกเชื่อมต่อ LINE
 * - getLineLinkStatus: เช็คว่าเชื่อม LINE แล้วหรือยัง
 */

/** สุ่ม token สำหรับเชื่อมบัญชี */
function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

// ---------- 1. createLineLinkToken ----------
/**
 * สร้าง token สำหรับเชื่อมบัญชี — เก็บใน line_link_tokens
 * ใช้ในหน้า LIFF: ดึง line_user_id จาก LIFF SDK → เรียก action นี้
 * คืน token + ลิงก์กลับมาหน้าเว็บเพื่อ claim
 */
export async function createLineLinkTokenAction(
  lineUserId: string,
  lineDisplayName?: string,
): Promise<{ token: string | null; error: string | null }> {
  if (!lineUserId) return { token: null, error: "ไม่พบ LINE userId" };

  const admin = createAdminClient();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 นาที

  const { error } = await admin.from("line_link_tokens").insert({
    token,
    line_user_id: lineUserId,
    line_display_name: lineDisplayName ?? null,
    expires_at: expiresAt.toISOString(),
  });

  if (error) return { token: null, error: error.message };
  return { token, error: null };
}

// ---------- 2. claimLineLinkToken ----------
/**
 * user ที่ login ในเว็บแล้ว → กดเชื่อมต่อ → ส่ง token มา claim
 * ระบบจะหา token ใน line_link_tokens → บันทึก line_user_id ใน users
 */
export async function claimLineLinkTokenAction(
  formData: FormData,
): Promise<{ error: string | null; lineDisplayName?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบก่อน" };

  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { error: "ไม่พบ token" };

  const admin = createAdminClient();

  // ค้น token ที่ยังไม่ใช้ + ยังไม่หมดอายุ
  const { data: linkRow, error: findErr } = await admin
    .from("line_link_tokens")
    .select("id, line_user_id, line_display_name, expires_at, used_at")
    .eq("token", token)
    .is("used_at", null)
    .maybeSingle();

  if (findErr || !linkRow) {
    return { error: "token ไม่ถูกต้องหรือถูกใช้แล้ว" };
  }

  // เช็คอายุ token
  if (new Date(linkRow.expires_at).getTime() < Date.now()) {
    return { error: "token หมดอายุแล้ว กรุณาเริ่มใหม่" };
  }

  // ตรวจว่า line_user_id นี้ถูกเชื่อมกับ user อื่นแล้วหรือไม่
  const { data: existing } = await admin
    .from("users")
    .select("id, full_name")
    .eq("line_user_id", linkRow.line_user_id)
    .maybeSingle();

  if (existing && existing.id !== user.id) {
    return {
      error: `LINE นี้ถูกเชื่อมกับบัญชี "${existing.full_name}" แล้ว`,
    };
  }

  // บันทึก line_user_id ใน users
  const { error: updateErr } = await admin
    .from("users")
    .update({ line_user_id: linkRow.line_user_id })
    .eq("id", user.id);

  if (updateErr) return { error: updateErr.message };

  // ทำเครื่องหมาย token ว่าใช้แล้ว
  await admin
    .from("line_link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", linkRow.id);

  revalidatePath("/member/profile");
  return {
    error: null,
    lineDisplayName: linkRow.line_display_name ?? undefined,
  };
}

// ---------- 3. unlinkLineAccount ----------
/** ยกเลิกเชื่อมต่อ LINE ของ user ปัจจุบัน */
export async function unlinkLineAccountAction(): Promise<{
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase
    .from("users")
    .update({ line_user_id: null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/member/profile");
  return { error: null };
}

// ---------- 4. getLineLinkStatus ----------
/** เช็คว่า user เชื่อม LINE แล้วหรือยัง */
export async function getLineLinkStatusAction(): Promise<{
  linked: boolean;
  lineDisplayName: string | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { linked: false, lineDisplayName: null, error: null };

  const { data } = await supabase
    .from("users")
    .select("line_user_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    linked: !!data?.line_user_id,
    lineDisplayName: null,
    error: null,
  };
}