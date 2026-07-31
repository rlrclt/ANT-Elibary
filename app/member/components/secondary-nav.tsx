"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhosphorIcon } from "../../components/phosphor-icon";

type Tab = {
  label: string;
  href: string;
  icon: string;
  danger?: boolean;
};

const TABS: Tab[] = [
  { label: "หน้าแรก", href: "/member", icon: "house" },
  { label: "หมวดหมู่ทั้งหมด", href: "/member/categories", icon: "grid-four" },
  { label: "หนังสือที่กำลังยืมอยู่", href: "/member/loans", icon: "book-open" },
  { label: "ค่าปรับของฉัน", href: "/member/fines", icon: "currency-circle-dollar" },
  { label: "รายการโปรด", href: "/member/favorites", icon: "heart" },
  { label: "เข้าห้องสมุด", href: "/member/access", icon: "door-open" },
   { label: "ข้อมูลโปรไฟล์", href: "/member/profile", icon: "user" },
];

/**
 * SecondaryNav — clone จาก AmnatCharoen.html
 * - Sticky top-[60px] z-40 bg-white dark:bg-card-bg border-b
 * - tabs แนวนอน scroll ได้ (hide-scrollbar)
 * - tab active: border-b-3 meb-green text-meb-green font-bold
 * - ใช้ usePathname ตรวจ active (href ตรงกับ pathname ปัจจุบัน)
 */
export function SecondaryNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-[60px] z-40 bg-white dark:bg-card-bg border-b border-gray-200 dark:border-border-base transition-colors">
      <div className="max-w-[1200px] mx-auto px-4">
        <ul className="flex items-center gap-6 overflow-x-auto hide-scrollbar h-12">
          {TABS.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== "/member" && pathname.startsWith(tab.href));
            return (
              <li key={tab.href} className="shrink-0">
                <Link
                  href={tab.href}
                  className={`flex items-center gap-1.5 text-sm font-medium h-12 border-b-3 transition whitespace-nowrap ${
                    isActive
                      ? "border-meb-green text-meb-green font-bold"
                      : tab.danger
                        ? "border-transparent text-price-red hover:text-price-red/80"
                        : "border-transparent text-slate-600 dark:text-slate-300 hover:text-meb-green"
                  }`}
                >
                  <PhosphorIcon
                    name={tab.icon}
                    weight={isActive ? "fill" : "regular"}
                    className="text-base"
                  />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}