"use client";

import Link from "next/link";
import { Header } from "../components/header";
import { AuthLayout } from "../components/auth-layout";
import { SimpleFooter } from "../components/simple-footer";
import { PhosphorIcon } from "../components/phosphor-icon";
import { TextField, SubmitButton } from "../components/form-controls";
import { useRegisterClient } from "../hooks/use-register-client";

export default function RegisterPage() {
  const { error, pending, submit } = useRegisterClient();

  return (
    <>
      <Header />
      <AuthLayout
        variant="register"
        title="สมัครสมาชิก"
        subtitle="ฟรีสำหรับนักศึกษาและบุคลากร วิทยาลัยเทคนิคอำนาจเจริญ"
        alternateHref="/login"
        alternateLabel="เข้าสู่ระบบ"
        alternatePrompt="มีบัญชีอยู่แล้ว?"
      >
        <form action={submit} className="space-y-1">
          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md"
            >
              <PhosphorIcon name="warning-circle" weight="fill" />
              {error}
            </div>
          )}

          <TextField
            label="ชื่อ-สกุล"
            name="full_name"
            placeholder="เช่น สมชาย ใจดี"
            autoComplete="name"
            required
            icon="user"
          />

          <TextField
            label="อีเมล"
            name="email"
            type="email"
            placeholder="you@acat.ac.th"
            autoComplete="email"
            required
            icon="envelope-simple"
            helper="แนะนำให้ใช้อีเมลสถาบัน (@acat.ac.th)"
          />

          <TextField
            label="เบอร์โทรศัพท์"
            name="phone"
            type="tel"
            placeholder="0812345678"
            autoComplete="tel"
            icon="phone"
            helper="ใช้สำหรับติดต่อเรื่องการยืม-คืน (ไม่บังคับ)"
          />

          <TextField
            label="รหัสผ่าน"
            name="password"
            type="password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
            autoComplete="new-password"
            required
            icon="lock"
            helper="ใช้ตัวอักษร ตัวเลข และสัญลักษณ์ผสมกันเพื่อความปลอดภัย"
          />

          <TextField
            label="ยืนยันรหัสผ่าน"
            name="confirmPassword"
            type="password"
            placeholder="พิมพ์รหัสผ่านอีกครั้ง"
            autoComplete="new-password"
            required
            icon="lock"
          />

          {/* เงื่อนไข — ตามกฎหน้า transactional ต้องโชว์ก่อน CTA */}
          <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer select-none my-5">
            <input
              type="checkbox"
              name="agree"
              required
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-meb-green focus:ring-meb-light"
            />
            <span>
              ฉันยอมรับ{" "}
              <Link
                href="/terms"
                className="text-meb-green hover:text-meb-hover hover:underline"
              >
                ข้อกำหนดการใช้งาน
              </Link>{" "}
              และ{" "}
              <Link
                href="/privacy"
                className="text-meb-green hover:text-meb-hover hover:underline"
              >
                นโยบายความเป็นส่วนตัว
              </Link>
            </span>
          </label>

          {/* role ส่งเป็น hidden — สมัครจากหน้านี้เป็น member เสมอ */}
          <input type="hidden" name="role" value="member" />

          <SubmitButton loading={pending}>
            สมัครสมาชิก
            <PhosphorIcon name="arrow-right" />
          </SubmitButton>
        </form>
      </AuthLayout>
      <SimpleFooter />
    </>
  );
}