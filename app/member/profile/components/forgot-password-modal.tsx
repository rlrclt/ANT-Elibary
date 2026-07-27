"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/app/components/modal";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { sendPasswordResetAction } from "../actions";

type ForgotPasswordModalProps = {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
};

/**
 * ForgotPasswordModal — มี 2 ขั้นตอน
 * ขั้นที่ 1: แสดงข้อความ + อีเมล + ปุ่ม "ส่งลิงก์รีเซ็ต" → เรียก sendPasswordResetAction
 * ขั้นที่ 2 (หลังส่งสำเร็จ): แสดงข้อความสำเร็จ + ปุ่มปิด
 * หมายเหตุ: Supabase ส่ง recovery LINK (ไม่ใช่ PIN) ไปยังอีเมล
 */
export function ForgotPasswordModal({
  open,
  onClose,
  userEmail,
}: ForgotPasswordModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // รีเซ็ต state เมื่อปิด modal
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setError(null);
        setSent(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleSend() {
    setError(null);
    if (!userEmail) {
      setError("ไม่มีอีเมลผูกกับบัญชี");
      return;
    }
    const formData = new FormData();
    formData.set("email", userEmail);

    startTransition(async () => {
      const res = await sendPasswordResetAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ลืมรหัสผ่าน"
      description="ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณ"
      size="sm"
    >
      {sent ? (
        // ขั้นที่ 2 — ส่งสำเร็จ
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 bg-meb-light text-meb-green rounded-full flex items-center justify-center text-3xl">
              <PhosphorIcon name="paper-plane-tilt" weight="fill" />
            </div>
          </div>
          <div className="bg-meb-light/50 border border-meb-green/30 text-meb-hover text-sm px-3 py-3 rounded-md leading-relaxed">
            ส่งอีเมลแล้ว กรุณาตรวจกล่องอีเมลของคุณ (รวมโฟลเดอร์ Spam) แล้วคลิกลิงก์เพื่อตั้งรหัสผ่านใหม่
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            หมายเหตุ: ระบบจะส่งลิงก์ (Link) ให้คลิก ไม่ใช่รหัส PIN
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn-cta w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-3 rounded-md text-sm shadow-sm"
          >
            <PhosphorIcon name="check" weight="bold" />
            ปิด
          </button>
        </div>
      ) : (
        // ขั้นที่ 1 — แสดงข้อมูล + ปุ่มส่ง
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm px-3 py-2.5 rounded-md">
            <PhosphorIcon name="info" weight="fill" className="text-lg shrink-0 mt-0.5" />
            <span>
              ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณ คุณต้องคลิกลิงก์ในอีเมลเพื่อตั้งรหัสผ่านใหม่
            </span>
          </div>

          {/* อีเมลที่จะส่งไป */}
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              อีเมล
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-md text-slate-700 dark:text-slate-200 font-medium break-all">
              <PhosphorIcon name="envelope-simple" className="text-slate-400 shrink-0" />
              <span>{userEmail || "ไม่มีอีเมลผูกกับบัญชี"}</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md">
              <PhosphorIcon name="warning-circle" weight="fill" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={pending || !userEmail}
            className="btn-cta w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-3 rounded-md text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? (
              <>
                <PhosphorIcon name="circle-notch" className="animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              <>
                <PhosphorIcon name="paper-plane-tilt" weight="fill" />
                ส่งลิงก์รีเซ็ต
              </>
            )}
          </button>
        </div>
      )}
    </Modal>
  );
}