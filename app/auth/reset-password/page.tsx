"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../components/phosphor-icon";
import { createClient } from "@/utils/supabase/client";

/**
 * หน้าตั้งรหัสผ่านใหม่ (/auth/reset-password)
 * ผู้ใช้มาที่นี่หลังคลิกลิงก์ recovery ในอีเมล (Supabase ส่ง recovery LINK ไม่ใช่ PIN)
 * - ใช้ client supabase เพื่อ exchange code เป็น session
 * - แสดงฟอร์ม newPassword + confirmPassword
 * - ส่ง updateUser({ password }) เพื่อตั้งรหัสผ่านใหม่
 * - สำเร็จ → แสดงข้อความ + ลิงก์ไป /login
 */
export default function ResetPasswordPage() {
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "success">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Exchange code จาก URL เป็น session (PKCE flow)
  useEffect(() => {
    let mounted = true;
    async function exchange() {
      // ตรวจหา session ที่อาจถูก set แล้ว (จาก callback redirect)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        if (mounted) setStatus("ready");
        return;
      }

      // พยายาม exchange code จาก query string (?code=) หรือ hash (#access_token=)
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (mounted) {
            setError("ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่");
            setStatus("error");
          }
          return;
        }
        if (mounted) setStatus("ready");
        return;
      }

      // ไม่มี code และไม่มี session → อาจเป็นกรณีเปิดผิดเบราว์เซอร์
      if (mounted) {
        setError(
          "ไม่พบรหัสยืนยัน หรือเบราว์เซอร์นี้ไม่ใช่เบราว์เซอร์ที่คุณขอลิงก์ — กรุณากลับไปที่หน้าโปรไลล์และขอลิงก์ใหม่",
        );
        setStatus("error");
      }
    }
    exchange();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    setError(null);
    if (newPassword.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }
    setStatus("success");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-cream dark:bg-page-bg transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-8 transition-colors">
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-8">
            <PhosphorIcon
              name="circle-notch"
              className="text-3xl text-meb-green animate-spin"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
              กำลังตรวจสอบลิงก์...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-price-red/10 flex items-center justify-center text-price-red text-3xl mb-5">
              <PhosphorIcon name="warning-circle" weight="fill" />
            </div>
            <h1 className="text-xl font-bold text-forest dark:text-slate-100 mb-2">
              ไม่สามารถตั้งรหัสผ่านใหม่ได้
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              {error}
            </p>
            <Link
              href="/login"
              className="btn-cta inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-5 py-2.5 rounded-md text-sm shadow-sm"
            >
              กลับไปหน้าเข้าสู่ระบบ
              <PhosphorIcon name="arrow-right" />
            </Link>
          </div>
        )}

        {status === "ready" && (
          <div>
            <div className="mb-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-meb-light flex items-center justify-center text-meb-green text-3xl mb-4">
                <PhosphorIcon name="lock-open" weight="fill" />
              </div>
              <h1 className="text-2xl font-bold text-forest dark:text-slate-100 mb-1.5">
                ตั้งรหัสผ่านใหม่
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md">
                <PhosphorIcon name="warning-circle" weight="fill" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-1">
              {/* รหัสผ่านใหม่ */}
              <div className="mb-4">
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
                >
                  รหัสผ่านใหม่ <span className="text-terracotta">*</span>
                </label>
                <div className="relative">
                  <PhosphorIcon
                    name="lock"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
                  />
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showNew ? "text" : "password"}
                    required
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                    aria-label={showNew ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    <PhosphorIcon name={showNew ? "eye-slash" : "eye"} className="text-lg" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">อย่างน้อย 8 ตัวอักษร</p>
              </div>

              {/* ยืนยันรหัสผ่านใหม่ */}
              <div className="mb-5">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
                >
                  ยืนยันรหัสผ่านใหม่ <span className="text-terracotta">*</span>
                </label>
                <div className="relative">
                  <PhosphorIcon
                    name="lock"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
                  />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    required
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                    aria-label={showConfirm ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    <PhosphorIcon name={showConfirm ? "eye-slash" : "eye"} className="text-lg" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-cta spotlight w-full inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-6 py-3 rounded-md text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <PhosphorIcon name="circle-notch" className="animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    ตั้งรหัสผ่านใหม่
                    <PhosphorIcon name="arrow-right" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-meb-light flex items-center justify-center text-meb-green text-3xl mb-5 animate-bounce">
              <PhosphorIcon name="check-circle" weight="fill" />
            </div>
            <h1 className="text-xl font-bold text-forest dark:text-slate-100 mb-2">
              ตั้งรหัสผ่านใหม่สำเร็จ
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
            </p>
            <Link
              href="/login"
              className="btn-cta spotlight inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-5 py-2.5 rounded-md text-sm shadow-sm"
            >
              ไปที่หน้าเข้าสู่ระบบ
              <PhosphorIcon name="arrow-right" />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}