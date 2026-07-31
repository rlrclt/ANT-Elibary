import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";

type Tab = {
  label: string;
  href: string;
  icon: string;
  active?: boolean;
  danger?: boolean;
};

const TABS: Tab[] = [
  { label: "หน้าแรก", href: "/", icon: "house", active: true },
  { label: "ขายดี", href: "/bestseller", icon: "trend-up" },
  { label: "มาใหม่", href: "/new", icon: "sparkle" },
  { label: "โปรโมชัน", href: "/promotions", icon: "tag", danger: true },
  { label: "ฟรีกระจาย", href: "/free", icon: "gift" },
];

/**
 * Secondary Nav แบบ tabs แนวนอน scroll ได้ (meb components.md ข้อ 2 แบบที่ 1)
 * ซ่อนบนมือถือ — tab active มี border-b-2 เขียว
 */
export function SecondaryNav() {
  return (
    <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-16 z-40">
      <div className="max-w-[1200px] mx-auto px-4">
        <ul className="flex items-center gap-6 overflow-x-auto hide-scrollbar h-12">
          {TABS.map((tab) => (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                className={`flex items-center gap-1.5 text-sm font-medium h-12 border-b-2 transition ${
                  tab.active
                    ? "border-meb-green text-meb-green"
                    : tab.danger
                      ? "border-transparent text-price-red hover:text-price-red/80"
                      : "border-transparent text-slate-600 hover:text-meb-green"
                }`}
              >
                <PhosphorIcon
                  name={tab.icon}
                  weight={tab.active ? "fill" : "regular"}
                  className="text-base"
                />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}