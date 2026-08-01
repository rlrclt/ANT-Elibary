"use client";

import { PhosphorIcon } from "./phosphor-icon";

/**
 * PrintButton — ปุ่มสั่งพิมพ์หน้านี้
 * - เรียก window.print() เพื่อเปิด dialog พิมพ์ของเบราว์เซอร์
 * - print CSS ใน staff layout จะซ่อน header/sidebar/footer อัตโนมัติ
 */
export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold bg-meb-green text-white hover:bg-meb-hover transition-colors ${className}`}
    >
      <PhosphorIcon name="printer" weight="fill" />
      พิมพ์
    </button>
  );
}
