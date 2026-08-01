"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { LogoutOverlay } from "./logout-overlay";

type StaffHeaderProps = {
  /** ชื่อ-สกุล จริง จาก public.users */
  fullName: string;
  /** รหัสผู้ใช้ จาก public.users.user_id_code */
  userIdCode: string;
  /** URL รูปโปรไฟล์ ถ้ามี */
  avatarUrl?: string | null;
  /** บทบาทจาก public.users (staff/admin จะเห็นปุ่มสลับไปหน้า member) */
  role?: string | null;
};

/**
 * StaffHeader — clone จาก AmnatCharoen.html
 * - โลโก้ วิทยาลัยเทคนิคอำนาจเจริญ (ซ้าย)
 * - ช่องค้นหา (กลาง, desktop เท่านั้น)
 * - แจ้งเตือน / ธีม / โปรไฟล์ dropdown (ขวา) ประกอบด้วย ตั้งค่าบัญชี + ออกจากระบบ
 * - staff/admin จะเห็นปุ่มสลับไปใช้งานหน้า member
 */
export function StaffHeader({
  fullName,
  userIdCode,
  avatarUrl,
  role,
}: StaffHeaderProps) {
  // ชื่อย่อสำหรับ avatar fallback (2 ตัวอักษรแรก)
  const initials = fullName.slice(0, 2).trim();

  // dropdown โปรไฟล์ (ตั้งค่าบัญชี / ออกจากระบบ)
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleLogout() {
    setLoggingOut(true);
    // LogoutOverlay จะจัดการ signOut + redirect ให้อัตโนมัติ
  }

  return (
    <>
    <LogoutOverlay active={loggingOut} />
    <header className="sticky top-0 z-50 bg-meb-green w-full shadow-md print:hidden">
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

          {/* User Profile Dropdown Trigger */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
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
                className={`text-xs hidden lg:block ml-1 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-card-bg rounded-xl shadow-xl border border-gray-100 dark:border-border-base overflow-hidden z-50 transition-colors">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-border-base bg-gray-50 dark:bg-black/20">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    รหัส: {userIdCode}
                  </p>
                </div>

                {/* Menu items */}
                <nav className="py-1">
                  {/* สลับไปใช้งานหน้า member — staff/admin เท่านั้น */}
                  {(role === "admin" || role === "staff") && (
                    <>
                      <Link
                        href="/member"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 transition"
                      >
                        <PhosphorIcon name="user" weight="fill" className="text-base text-meb-green" />
                        สลับไปใช้งาน Member
                      </Link>
                      <div className="border-t border-gray-100 dark:border-border-base" />
                    </>
                  )}
                  <Link
                    href="/staff/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 transition"
                  >
                    <PhosphorIcon name="gear" className="text-base text-slate-500 dark:text-slate-400" />
                    ตั้งค่าบัญชี
                  </Link>
                </nav>

                {/* Divider */}
                <div className="border-t border-gray-100 dark:border-border-base" />

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-price-red hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60"
                >
                  <PhosphorIcon
                    name={loggingOut ? "circle-notch" : "sign-out"}
                    weight={loggingOut ? "bold" : "regular"}
                    className={`text-base ${loggingOut ? "animate-spin" : ""}`}
                  />
                  {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  );
}