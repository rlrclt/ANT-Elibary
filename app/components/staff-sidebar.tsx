"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhosphorIcon } from "./phosphor-icon";
import { LogoutOverlay } from "./logout-overlay";

type StaffSidebarProps = {
  fullName: string;
  department?: string | null;
  classLevel?: string | null;
  avatarUrl?: string | null;
};

/**
 * StaffSidebar — sidebar ของเจ้าหน้าที่
 * - หุบ/แสดงได้ (เก็บสถานะใน localStorage)
 * - เมนูนำทาง (active state จาก usePathname)
 * - ตั้งค่า + ออกจากระบบ ด้านล่าง
 * - sticky ใต้ header
 * - ซ่อนบนมือถือ
 */
export function StaffSidebar({
  fullName,
  department,
  classLevel,
  avatarUrl,
}: StaffSidebarProps) {
  const pathname = usePathname();
  const initials = fullName.slice(0, 2).trim();

  // สถานะหุบ/แสดง — อ่านจาก localStorage
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("staff-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("staff-sidebar-collapsed", String(next));
  }

  const menu = [
    { href: "/staff", label: "แดชบอร์ด", icon: "squares-four" },
    { href: "/staff/books", label: "จัดการหนังสือ", icon: "books" },
    { href: "/staff/members", label: "จัดการสมาชิก", icon: "users" },
    { href: "/staff/loans", label: "ยืม-คืน", icon: "arrow-clock" },
    { href: "/staff/access-logs", label: "การเข้าใช้ห้องสมุด", icon: "door-open" },
    { href: "/staff/announcements", label: "จัดการประกาศ", icon: "megaphone" },
    { href: "/staff/categories", label: "หมวดหมู่", icon: "grid-four" },
  ];

  const isActive = (href: string) =>
    href === "/staff" ? pathname === "/staff" : pathname.startsWith(href);

  return (
    <>
    <aside className={`hidden md:block shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
      <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden sticky top-[84px] transition-colors">
        {/* Quick User Info */}
        <div className="p-3 border-b border-gray-100 dark:border-border-base bg-gray-50 dark:bg-black/30 flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-full bg-meb-green flex items-center justify-center text-white font-bold text-sm shadow-inner overflow-hidden shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-slate-800 text-sm truncate">
                {fullName}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {department ?? "เจ้าหน้าที่ห้องสมุด"}
                {classLevel ? ` • ${classLevel}` : ""}
              </p>
            </div>
          )}
        </div>

        {/* Menu Links */}
        <nav className="p-2 space-y-1">
          {menu.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  active
                    ? "bg-meb-light text-meb-green"
                    : "text-gray-600 hover:bg-gray-50 hover:text-meb-green"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <PhosphorIcon
                  name={item.icon}
                  weight={active ? "fill" : "regular"}
                  className="text-xl shrink-0"
                />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Settings + Logout */}
        <div className="p-2 border-t border-gray-100 dark:border-border-base transition-colors">
          <Link
            href="/staff/settings"
            title={collapsed ? "ตั้งค่าบัญชี" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <PhosphorIcon name="gear" className="text-xl shrink-0" />
            {!collapsed && <span className="text-sm">ตั้งค่าบัญชี</span>}
          </Link>
          <button
            type="button"
            onClick={() => setLoggingOut(true)}
            title={collapsed ? "ออกจากระบบ" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-price-red hover:bg-red-50 font-medium transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <PhosphorIcon name="sign-out" className="text-xl shrink-0" />
            {!collapsed && <span className="text-sm">ออกจากระบบ</span>}
          </button>
        </div>

        {/* ปุ่มหุบ/แสดง sidebar — ไว้ล่างสุด */}
        <div className="p-2 border-t border-gray-100 dark:border-border-base">
          <button
            onClick={toggleCollapsed}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-md text-slate-500 dark:text-slate-400 hover:text-meb-green hover:bg-meb-light/50 dark:hover:bg-white/10 transition text-xs font-medium ${
              collapsed ? "" : "flex-row-reverse"
            }`}
            aria-label={collapsed ? "แสดงเมนู" : "หุบเมนู"}
            title={collapsed ? "แสดงเมนู" : "หุบเมนู"}
          >
            <PhosphorIcon
              name={collapsed ? "caret-double-right" : "caret-double-left"}
              weight="bold"
              className="text-base"
            />
            {!collapsed && <span>หุบเมนู</span>}
          </button>
        </div>
      </div>
    </aside>
    <LogoutOverlay active={loggingOut} />
    </>
  );
}