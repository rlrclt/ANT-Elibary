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
  role?: string | null;
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
  role,
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

  // เมนูจัดหมวดหมู่: [หัวข้อกลุ่ม, รายการเมนู]
  const menuGroups: {
    group: string;
    icon: string;
    items: { href: string; label: string; icon: string }[];
  }[] = [
    {
      group: "ภาพรวม",
      icon: "layout",
      items: [{ href: "/staff", label: "แดชบอร์ด", icon: "squares-four" }],
    },
    {
      group: "จัดการหนังสือ",
      icon: "books",
      items: [
        { href: "/staff/books", label: "คลังหนังสือ", icon: "books" },
        { href: "/staff/books/old", label: "หนังสือเก่า", icon: "hourglass-high" },
        { href: "/staff/books/reports", label: "รายงานหนังสือ", icon: "chart-bar" },
        { href: "/staff/books/damaged", label: "หนังสือชำรุด", icon: "warning-circle" },
        { href: "/staff/books/history", label: "รายงานยืม-คืน", icon: "chart-pie-slice" },
      ],
    },
    {
      group: "ยืม-คืน & ค่าปรับ",
      icon: "arrows-left-right",
      items: [
        { href: "/staff/loans", label: "ยืม-คืน", icon: "hand-arrow-up" },
        { href: "/staff/fines", label: "ค่าปรับ + QR", icon: "currency-circle-dollar" },
      ],
    },
    {
      group: "สมาชิก",
      icon: "users",
      items: [
        { href: "/staff/members", label: "จัดการสมาชิก", icon: "users" },
        { href: "/staff/groups", label: "เจาะกลุ่มเรียน", icon: "tree-structure" },
        { href: "/staff/access-logs", label: "การเข้าใช้ห้องสมุด", icon: "door-open" },
      ],
    },
    {
      group: "ประชาสัมพันธ์",
      icon: "megaphone",
      items: [
        { href: "/staff/announcements", label: "จัดการประกาศ", icon: "megaphone" },
        { href: "/staff/banners", label: "จัดการ Banner", icon: "image" },
        { href: "/staff/line-preview", label: "LINE Flex Message", icon: "chat-circle-dots" },
      ],
    },
    {
      group: "ระบบ",
      icon: "sliders",
      items: [
        ...(role === "admin"
          ? [{ href: "/staff/settings/dropdowns", label: "จัดการข้อมูลตัวเลือก", icon: "sliders" }]
          : []),
      ],
    },
  ];

  const isActive = (href: string) =>
    href === "/staff" ? pathname === "/staff" : pathname.startsWith(href);

  return (
    <>
    <aside className={`hidden md:block shrink-0 transition-all duration-300 print:hidden ${collapsed ? "w-16" : "w-64"}`}>
      <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden sticky top-[84px] flex flex-col max-h-[calc(100vh-104px)] transition-colors">
        {/* Quick User Info */}
        <div className="p-3 border-b border-gray-100 dark:border-border-base bg-gray-50 dark:bg-black/30 flex items-center gap-3 shrink-0 transition-colors">
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

        {/* Menu Links — เลื่อนเองได้ถ้ายาวเกินจอ */}
        <nav className="p-2 space-y-3 flex-1 overflow-y-auto">
          {menuGroups.map((g) => {
            const items = g.items.filter((i) => i.label);
            if (items.length === 0) return null;
            return (
              <div key={g.group}>
                {/* หัวข้อกลุ่ม */}
                <div
                  className={`flex items-center gap-2 px-3 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ${
                    collapsed ? "justify-center" : ""
                  }`}
                  title={collapsed ? g.group : undefined}
                >
                  <PhosphorIcon
                    name={g.icon}
                    className="text-sm shrink-0"
                    weight="fill"
                  />
                  {!collapsed && <span className="truncate">{g.group}</span>}
                </div>
                <div className="space-y-1 mt-1">
                  {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                          active
                            ? "bg-meb-light text-meb-green"
                            : "text-gray-600 hover:bg-gray-50 hover:text-meb-green dark:text-slate-300 dark:hover:bg-white/5"
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
                </div>
              </div>
            );
          })}
        </nav>

        {/* Settings + Logout */}
        <div className="p-2 border-t border-gray-100 dark:border-border-base shrink-0 transition-colors">
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
        <div className="p-2 border-t border-gray-100 dark:border-border-base shrink-0">
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