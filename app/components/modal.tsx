"use client";

import { useEffect, type ReactNode } from "react";
import { PhosphorIcon } from "./phosphor-icon";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** ขนาด modal — default md (max-w-lg) */
  size?: "sm" | "md" | "lg" | "xl";
  /** ปิดเมื่อคลิก backdrop (default true) */
  closeOnBackdrop?: boolean;
};

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Modal — กล่อง popup กลางจอ พื้นหลัง dim
 * - ปิดด้วย ESC, คลิก backdrop, ปุ่ม X
 * - scroll lock ตอนเปิด
 * - รองรับ dark mode
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnBackdrop = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);

    // ล็อก scroll ทั้ง body และ html ป้องกันพื้นหลังขยับ
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-hidden overscroll-none"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal panel */}
      <div
        className={`relative w-full ${SIZE_CLASS[size]} max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col bg-white dark:bg-card-bg rounded-2xl shadow-2xl border border-gray-100 dark:border-border-base my-auto transition-colors overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-border-base shrink-0 bg-white dark:bg-card-bg">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-bold text-forest dark:text-slate-100">
              {title}
            </h2>
            {description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 transition"
            aria-label="ปิด"
          >
            <PhosphorIcon name="x" className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}