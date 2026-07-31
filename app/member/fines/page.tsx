import type { Metadata } from "next";
import Link from "next/link";
import { PhosphorIcon } from "../../components/phosphor-icon";
import { MyFinesClient } from "./components/my-fines-client";

export const metadata: Metadata = {
  title: "ค่าปรับของฉัน",
};

/**
 * หน้าค่าปรับของฉัน — /member/fines
 * - สมาชิกดูยอดคงค้าง + รายการชำระค่าปรับ + แนบสลิปการโอน
 * - มี auth guard ฝั่ง layout (member/layout.tsx)
 * - โหลดข้อมูลฝั่ง client ผ่าน useEffect (ตามรูปแบบ my-fines-client)
 */
export default async function FinesPage() {
  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <nav
        aria-label="breadcrumb"
        className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap"
      >
        <Link href="/member" className="hover:text-meb-green transition">
          หน้าแรก
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200 font-medium">
          ค่าปรับของฉัน
        </span>
      </nav>

      {/* Header */}
      <div className="p-5 sm:p-6 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base relative overflow-hidden transition-colors shadow-sm">
        <div className="absolute top-0 left-0 bottom-0 w-2 bg-price-red" />
        <div className="pl-2 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
              <PhosphorIcon
                name="currency-circle-dollar"
                weight="fill"
                className="text-price-red"
              />
              ค่าปรับของฉัน
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              ตรวจสอบยอดคงค้างและแนบสลิปการโอนเงิน
            </p>
          </div>
        </div>
      </div>

      {/* เนื้อหาหลัก */}
      <MyFinesClient />
    </div>
  );
}