"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "../components/header";
import { AuthLayout } from "../components/auth-layout";
import { SimpleFooter } from "../components/simple-footer";
import { PhosphorIcon } from "../components/phosphor-icon";
import { TextField, SubmitButton } from "../components/form-controls";
import { useLoginAction } from "../hooks/use-auth-actions";

function LoginForm() {
  const [state, formAction, pending] = useLoginAction();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";

  return (
    <>
      <Header />
      <AuthLayout
        variant="login"
        title="เข้าสู่ระบบ"
        subtitle="ยินดีต้อนรับกลับสู่ ANT E-Library"
        alternateHref="/register"
        alternateLabel="สมัครสมาชิก"
        alternatePrompt="ยังไม่มีบัญชี?"
      >
        {/* แจ้งเตือนหลังสมัครเสร็จ */}
        {justRegistered && (
          <div className="mb-4 flex items-center gap-2 bg-meb-light border border-meb-green/30 text-meb-hover text-sm px-3 py-2.5 rounded-md">
            <PhosphorIcon name="check-circle" weight="fill" />
            สมัครสมาชิกสำเร็จ — กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่สมัคร
          </div>
        )}

        <form action={formAction} className="space-y-1">
          {/* Error message */}
          {state.error && (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md"
            >
              <PhosphorIcon name="warning-circle" weight="fill" />
              {state.error}
            </div>
          )}

          <TextField
            label="อีเมล"
            name="email"
            type="email"
            placeholder="you@example.ac.th"
            autoComplete="email"
            required
            icon="envelope-simple"
          />

          <TextField
            label="รหัสผ่าน"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            icon="lock"
          />

          {/* จำฉันไว้ + ลืมรหัสผ่าน — 2 items 2 ฝั่ง (Gutenberg: ขวา = ลำดับรอง) */}
          <div className="flex items-center justify-between mb-5 mt-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                name="remember"
                className="w-4 h-4 rounded border-gray-300 text-meb-green focus:ring-meb-light"
              />
              จำฉันไว้
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-meb-green hover:text-meb-hover hover:underline"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>

          <SubmitButton loading={pending}>
            เข้าสู่ระบบ
            <PhosphorIcon name="arrow-right" />
          </SubmitButton>
        </form>
      </AuthLayout>
      <SimpleFooter />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-screen bg-cream">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}