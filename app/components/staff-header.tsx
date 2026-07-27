"use client";

import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

type StaffHeaderProps = {
  /** ชื่อ-สกุล จริง จาก public.users */
  fullName: string;
  /** รหัสผู้ใช้ จาก public.users.user_id_code */
  userIdCode: string;
  /** URL รูปโปรไฟล์ ถ้ามี */
  avatarUrl?: string | null;
};

/**
 * StaffHeader — clone จาก AmnatCharoen.html
 * - โลโก้ วิทยาลัยเทคนิคอำนาจเจริญ (ซ้าย)
 * - ช่องค้นหา (กลาง, desktop เท่านั้น)
 * - แจ้งเตือน / ตะกร้า / โปรไฟล์ dropdown (ขวา)
 * - ปุ่มค้นหาและ profile แสดงบนมือถือด้วย
 */
export function StaffHeader({
  fullName,
  userIdCode,
  avatarUrl,
}: StaffHeaderProps) {
  // ชื่อย่อสำหรับ avatar fallback (2 ตัวอักษรแรก)
  const initials = fullName.slice(0, 2).trim();

  return (
    <header className="sticky top-0 z-50 bg-meb-green w-full shadow-md">
      <div className="max-w-[1200px] mx-auto h-[60px] px-4 flex items-center justify-between gap-4">
        {/* Logo area */}
        <Link
          href="/"
          className="flex items-center gap-2 text-white hover:text-white/90 shrink-0 focus:outline-none focus:ring-2 focus:ring-white rounded"
        >
          <PhosphorIcon name="buildings" weight="fill" className="text-3xl" />
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight hidden sm:block leading-none mt-1">
              วิทยาลัยเทคนิคอำนาจเจริญ
            </span>
            <span className="text-[10px] tracking-wider uppercase hidden sm:block">
              E-Library
            </span>
          </div>
        </Link>

        {/* Search Bar (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-xl relative mx-4">
          <input
            type="text"
            placeholder="ค้นหาในชั้นหนังสือของคุณ หรือค้นหาหนังสือใหม่..."
            className="w-full h-10 pl-4 pr-10 rounded-md text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/40 bg-white shadow-sm"
          />
          <button
            className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-gray-500 hover:text-meb-green bg-white rounded-r-md"
            aria-label="ค้นหา"
          >
            <PhosphorIcon name="magnifying-glass" weight="bold" className="text-lg" />
          </button>
        </div>

        {/* Logged-in Actions */}
        <div className="flex items-center gap-5 shrink-0 text-white">
          <button
            className="md:hidden flex items-center justify-center text-2xl hover:text-meb-light focus:outline-none"
            aria-label="ค้นหา"
          >
            <PhosphorIcon name="magnifying-glass" />
          </button>

          {/* Notifications — popup 2 tabs (แจ้งเตือน/ข่าวสาร) */}
          <NotificationBell />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Cart */}
          <Link
            href="/staff/borrow"
            className="relative hidden sm:flex items-center justify-center text-2xl hover:text-meb-light transition-colors focus:outline-none rounded"
            aria-label="ตะกร้ายืม"
          >
            <PhosphorIcon name="shopping-cart-simple" />
          </Link>

          {/* User Profile Dropdown Trigger */}
          <button
            className="flex items-center gap-2 hover:bg-meb-nav pl-2 pr-3 py-1.5 rounded-lg transition-colors focus:outline-none ml-2 border border-transparent hover:border-white/20"
            aria-label="โปรไฟล์"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold">{initials}</span>
              )}
            </div>
            <div className="flex flex-col text-left hidden lg:flex">
              <span className="text-xs font-bold leading-none truncate w-24">
                {fullName}
              </span>
              <span className="text-[10px] text-meb-light">
                รหัส: {userIdCode}
              </span>
            </div>
            <PhosphorIcon
              name="caret-down"
              weight="bold"
              className="text-xs hidden lg:block ml-1"
            />
          </button>
        </div>
      </div>
    </header>
  );
}