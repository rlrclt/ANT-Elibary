"use client";

import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import type {
  MemberBorrowRecord,
  MemberFineSummary,
} from "../actions";

type MyFinesProps = {
  summary: MemberFineSummary;
  borrows: MemberBorrowRecord[];
  onRefresh: () => void;
};

/**
 * MyFines — สรุปยอดค่าปรับในแท็บ "ยืม/คืน"
 * เก็บเฉพาะสรุป + ปุ่มลิงก์ไปยังหน้า /member/fines (จุดเดียวที่จัดการค่าปรับเต็มรูปแบบ:
 * QR / บัญชีรับโอน + แนบสลิป + สถานะ) เพื่อไม่ให้มีข้อมูลซ้ำซ้อนกันสองที่
 */

export function MyFines({ summary }: MyFinesProps) {
  return (
    <div className="space-y-4">
      {/* ====== สรุปค่าปรับ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <PhosphorIcon
            name="currency-dollar"
            weight="fill"
            className="text-price-red text-lg"
          />
          <h2 className="text-base font-bold text-forest dark:text-slate-100">
            สรุปค่าปรับ
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* ยอดค้างชำระ */}
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              ยอดค้างชำระ
            </p>
            <p className="text-2xl font-bold text-price-red">
              ฿{summary.totalUnpaid.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* จำนวนรายการค้าง */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              รายการค้างชำระ
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.unpaidCount}
            </p>
          </div>

          {/* จำนวนรายการที่ชำระแล้ว */}
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              รายการที่ชำระแล้ว
            </p>
            <p className="text-2xl font-bold text-meb-green">
              {summary.paidCount}
            </p>
          </div>
        </div>
      </section>

      {/* ====== การ์ดลิงก์ไปจัดการค่าปรับ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-meb-light dark:bg-meb-green/15 flex items-center justify-center text-meb-green shrink-0">
              <PhosphorIcon name="qr-code" weight="fill" className="text-xl" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-forest dark:text-slate-100">
                ไปหน้าค่าปรับของฉัน
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ดู QR / บัญชีรับโอน แนบสลิปการโอน และติดตามสถานะการตรวจสอบค่าปรับ
              </p>
            </div>
          </div>
          <Link
            href="/member/fines"
            className="inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-5 py-2.5 rounded-md text-sm shadow-sm transition shrink-0"
          >
            <PhosphorIcon name="currency-circle-dollar" weight="bold" className="text-base" />
            จัดการค่าปรับ
          </Link>
        </div>
      </section>
    </div>
  );
}
