"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { SubmitButton } from "../../../components/form-controls";
import { changePasswordAction } from "../actions";

type ChangePasswordFormProps = {
  userEmail: string | null;
  onForgotPassword: () => void;
};

/** Custom password field พร้อมปุ่ม toggle ตา */
function PasswordField({
  label,
  name,
  placeholder,
  required,
  helper,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  helper?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
      >
        {label}
        {required && <span className="text-terracotta ml-0.5">*</span>}
      </label>
      <div className="relative">
        <PhosphorIcon
          name="lock"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
        />
        <input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          required={required}
          className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light placeholder:text-slate-400 text-forest dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
          aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        >
          <PhosphorIcon name={show ? "eye-slash" : "eye"} className="text-lg" />
        </button>
      </div>
      {helper && <p className="text-xs text-slate-500 mt-1.5">{helper}</p>}
    </div>
  );
}

/**
 * ChangePasswordForm — ฟอร์มเปลี่ยนรหัสผ่าน (เจ้าหน้าที่)
 * ต้องยืนยันรหัสผ่านปัจจุบันก่อน
 * ถ้าไม่มีอีเมลผูกบัญชี → แสดงข้อความแจ้งและซ่อนฟอร์ม
 * ด้านล่างมีลิงก์ "ลืมรหัสผ่าน?" เปิด ForgotPasswordModal
 */
export function ChangePasswordForm({
  userEmail,
  onForgotPassword,
}: ChangePasswordFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await changePasswordAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setSuccess(false), 4000);
    });
  }

  return (
    <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 sm:p-6 transition-colors space-y-5">
      <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2 border-b border-gray-100 dark:border-border-base/50 pb-3">
        <PhosphorIcon name="key" className="text-meb-green" weight="fill" />
        เปลี่ยนรหัสผ่าน
      </h2>

      {userEmail === null ? (
        <div className="flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md">
          <PhosphorIcon name="warning-circle" weight="fill" />
          ไม่สามารถเปลี่ยนรหัสผ่านได้ เนื่องจากไม่มีอีเมลผูกกับบัญชี
        </div>
      ) : (
        <>
          {success && (
            <div className="flex items-center gap-2 bg-meb-light/50 border border-meb-green/30 text-meb-hover text-sm px-3 py-2.5 rounded-md">
              <PhosphorIcon name="check-circle" weight="fill" />
              เปลี่ยนรหัสผ่านสำเร็จ
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md">
              <PhosphorIcon name="warning-circle" weight="fill" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-1">
            <PasswordField
              label="รหัสผ่านปัจจุบัน"
              name="currentPassword"
              placeholder="••••••••"
              required
            />
            <PasswordField
              label="รหัสผ่านใหม่"
              name="newPassword"
              placeholder="อย่างน้อย 8 ตัวอักษร"
              required
              helper="อย่างน้อย 8 ตัวอักษร"
            />
            <PasswordField
              label="ยืนยันรหัสผ่านใหม่"
              name="confirmPassword"
              placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
              required
            />

            <SubmitButton loading={pending}>
              เปลี่ยนรหัสผ่าน
              <PhosphorIcon name="arrow-right" />
            </SubmitButton>
          </form>

          <div className="pt-2 border-t border-gray-100 dark:border-border-base/50">
            <button
              type="button"
              onClick={onForgotPassword}
              className="inline-flex items-center gap-1.5 text-sm text-meb-green hover:text-meb-hover hover:underline font-medium"
            >
              <PhosphorIcon name="question" />
              ลืมรหัสผ่าน?
            </button>
          </div>
        </>
      )}
    </section>
  );
}