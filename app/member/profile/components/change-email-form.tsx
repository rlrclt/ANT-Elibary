"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { TextField, SubmitButton } from "@/app/components/form-controls";
import { changeEmailAction } from "../actions";

type ChangeEmailFormProps = {
  currentEmail: string | null;
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
 * ChangeEmailForm — ฟอร์มเปลี่ยนอีเมล
 * ต้องยืนยันรหัสผ่านปัจจุบัน — Supabase จะส่งอีเมลยืนยันไปที่อีเมลใหม่
 * ผู้ใช้ต้องคลิกลิงก์ในอีเมลนั้นก่อน การเปลี่ยนแปลงจึงจะมีผล
 */
export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    const newEmail = String(formData.get("newEmail") ?? "").trim();

    startTransition(async () => {
      const res = await changeEmailAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(newEmail);
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setSuccess(null), 6000);
    });
  }

  return (
    <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 sm:p-6 transition-colors space-y-5">
      <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2 border-b border-gray-100 dark:border-border-base/50 pb-3">
        <PhosphorIcon name="envelope-simple" className="text-meb-green" weight="fill" />
        เปลี่ยนอีเมล
      </h2>

      {/* อีเมลปัจจุบัน (อ่านอย่างเดียว) */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          อีเมลปัจจุบัน
        </label>
        <div className="flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-md text-slate-700 dark:text-slate-200 font-bold break-all">
          <PhosphorIcon name="at" className="text-slate-400 shrink-0" />
          <span>{currentEmail || "—"}</span>
        </div>
      </div>

      {/* Info box — อธิบายกระบวนการยืนยันอีเมล */}
      <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm px-3 py-2.5 rounded-md">
        <PhosphorIcon name="info" weight="fill" className="text-lg shrink-0 mt-0.5" />
        <span>
          เมื่อเปลี่ยนอีเมล ระบบจะส่งอีเมลยืนยันไปที่อีเมลใหม่ คุณต้องคลิกลิงก์ในอีเมลนั้นก่อน
          การเปลี่ยนแปลงจึงจะมีผล
        </span>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-meb-light/50 border border-meb-green/30 text-meb-hover text-sm px-3 py-2.5 rounded-md">
          <PhosphorIcon name="check-circle" weight="fill" />
          ส่งอีเมลยืนยันไปที่ {success} แล้ว — กรุณาคลิกลิงก์ในอีเมลเพื่อยืนยันการเปลี่ยนแปลง
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md">
          <PhosphorIcon name="warning-circle" weight="fill" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-1">
        <TextField
          label="อีเมลใหม่"
          name="newEmail"
          type="email"
          required
          placeholder="you@example.ac.th"
          icon="envelope-simple"
        />
        <PasswordField
          label="รหัสผ่านปัจจุบัน"
          name="currentPassword"
          placeholder="••••••••"
          required
          helper="ยืนยันรหัสผ่านเพื่อความปลอดภัย"
        />

        <SubmitButton loading={pending}>
          ส่งคำขอเปลี่ยนอีเมล
          <PhosphorIcon name="paper-plane-tilt" />
        </SubmitButton>
      </form>
    </section>
  );
}