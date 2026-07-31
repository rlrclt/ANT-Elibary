import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";

/**
 * Auth Callback — Supabase ส่ง user มาที่นี่หลังคลิกลิงก์ในอีเมล
 * รองรับทั้งแบบ code จาก query string (PKCE code flow) และ token_hash (OTP verification flow)
 * จากนั้น redirect ไปหน้าแจ้งผลยืนยันสำเร็จ
 *
 * ต้องตั้ง Site URL ใน Supabase Dashboard เป็น http://localhost:3000
 * และเพิ่ม http://localhost:3000/** ใน Redirect URLs
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const next = url.searchParams.get("next") ?? "/auth/confirm";

  // ถ้า Supabase ส่ง error มา (เช่น link หมดอายุ) → ส่งไปหน้าแจ้ง error
  if (error) {
    redirect(
      `/auth/confirm?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription ?? "")}`,
    );
  }

  const supabase = await createClient();

  if (token_hash && type) {
    // การยืนยันด้วย token_hash (เช่น จาก email template ที่ใช้ token_hash)
    // วิธีนี้จะไม่เกิดปัญหา PKCE code verifier not found ในกรณีเปิดคนละเบราว์เซอร์
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (error) {
      redirect(
        `/auth/confirm?error=verification_failed&description=${encodeURIComponent(error.message)}`,
      );
    }
  } else if (code) {
    // แบบดั้งเดิม (PKCE flow) — จำเป็นต้องมี code verifier ใน cookie ของเบราว์เซอร์นั้น ๆ
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(
        `/auth/confirm?error=exchange_failed&description=${encodeURIComponent(error.message)}`,
      );
    }
  } else {
    // ไม่มีพารามิเตอร์ส่งมาเลย → ส่งไปหน้ายืนยันเฉยๆ (จะมีการตรวจ session ในนั้น)
    redirect("/auth/confirm");
  }

  redirect(next);
}