import type { Metadata } from "next";
import Link from "next/link";
import { PhosphorIcon } from "../../components/phosphor-icon";
import { MyFinesClient } from "./components/my-fines-client";
import {
  getFineBalanceAction,
  getMyFinesAction,
  getPaymentMethodsAction,
} from "./actions";

export const metadata: Metadata = {
  title: "ค่าปรับของฉัน",
};

/**
 * หน้าค่าปรับของฉัน — /member/fines
 * - สมาชิกดูยอดคงค้าง + วิธีชำระ (QR/บัญชี) + รายการค่าปรับ + แนบสลิป
 * - มี auth guard ฝั่ง layout (member/layout.tsx)
 * - โหลดข้อมูลเริ่มต้นฝั่ง server แล้วส่งเป็น prop เพื่อตัดจังหวะ loading ของ client
 */
export default async function FinesPage() {
  const [balanceRes, finesRes, methodsRes] = await Promise.all([
    getFineBalanceAction(),
    getMyFinesAction(),
    getPaymentMethodsAction(),
  ]);

  const balance = balanceRes.data ?? 0;
  const fines = finesRes.data ?? [];
  const methods = methodsRes.data ?? [];

  // สรุปยอดจากรายการค่าปรับ (สำหรับแสดงสถิติใน header)
  const unpaidCount = fines.filter((f) =>
    ["unpaid", "counter_pending", "pending", "rejected"].includes(f.status),
  ).length;
  const paidCount = fines.filter(
    (f) => f.status === "approved" || f.status === "counter_paid",
  ).length;

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
        <div className="pl-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              ตรวจสอบยอดคงค้าง ชำระเงิน และแนบสลิปการโอน ได้ที่นี่
            </p>
          </div>

          {/* สรุปสถิติย่อ */}
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">ค่าปรับคงค้าง</p>
              <p className={`font-bold text-lg ${balance > 0 ? "text-price-red" : "text-slate-400 dark:text-slate-500"}`}>
                ฿{balance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">รายการค้างชำระ</p>
              <p className={`font-bold text-lg ${unpaidCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}>
                {unpaidCount}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">ชำระแล้ว</p>
              <p className="font-bold text-lg text-meb-green">
                {paidCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* เนื้อหาหลัก */}
      <MyFinesClient
        initialBalance={balance}
        initialFines={fines}
        initialMethods={methods}
      />
    </div>
  );
}
