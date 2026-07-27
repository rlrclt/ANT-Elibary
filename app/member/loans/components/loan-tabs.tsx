"use client";

import { useState } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { QuickBorrowReturn } from "./quick-borrow-return";
import { MyBorrows } from "./my-borrows";
import { MyFines } from "./my-fines";
import type {
  MemberBorrowRecord,
  MemberFineSummary,
} from "../actions";

type LoanTabsProps = {
  initialBorrows: MemberBorrowRecord[];
  initialActive: MemberBorrowRecord[];
  initialFines: MemberFineSummary;
  userId: string;
};

type TabKey = "borrow-return" | "my-borrows" | "fines";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "borrow-return", label: "ยืม/คืน", icon: "arrows-clockwise" },
  { key: "my-borrows", label: "การยืมของฉัน", icon: "books" },
  { key: "fines", label: "ค่าปรับ", icon: "currency-dollar" },
];

/**
 * LoanTabs — ตัวควบคุมแท็บหลักของหน้า /member/loans
 * มี 3 แท็บ: ยืม/คืน, การยืมของฉัน, ค่าปรับ
 * จัดการ state ข้อมูลร่วม (borrows, active, fines) และส่ง callback refresh ให้ลูก
 */
export function LoanTabs({
  initialBorrows,
  initialActive,
  initialFines,
  userId,
}: LoanTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("borrow-return");
  const [borrows, setBorrows] = useState<MemberBorrowRecord[]>(initialBorrows);
  const [active, setActive] = useState<MemberBorrowRecord[]>(initialActive);
  const [fines, setFines] = useState<MemberFineSummary>(initialFines);

  // แยก history (returned) จาก borrows ทั้งหมด
  const history = borrows.filter((b) => b.returned_at !== null);

  // refresh ข้อมูลทั้งหมด (เรียกหลังยืม/คืน/ต่ออายุ/ชำระค่าปรับ)
  async function refreshAll() {
    const [borrowsRes, activeRes, finesRes] = await Promise.all([
      import("../actions").then((m) => m.getMyBorrowsAction()),
      import("../actions").then((m) => m.getMyActiveBorrowsAction()),
      import("../actions").then((m) => m.getMyFineSummaryAction()),
    ]);
    if (borrowsRes.data) setBorrows(borrowsRes.data);
    if (activeRes.data) setActive(activeRes.data);
    if (finesRes.data) setFines(finesRes.data);
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <nav
        className="flex border-b border-gray-100 dark:border-border-base overflow-x-auto"
        aria-label="แท็บยืม-คืน"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-semibold transition-colors -mb-px border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-meb-green text-meb-green"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-forest dark:hover:text-slate-200"
              }`}
            >
              <PhosphorIcon name={tab.icon} weight={isActive ? "fill" : "regular"} />
              {tab.label}
              {tab.key === "fines" && fines.unpaidCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-price-red rounded-full">
                  {fines.unpaidCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      {activeTab === "borrow-return" && (
        <QuickBorrowReturn
          userId={userId}
          activeBorrows={active}
          onBorrowed={refreshAll}
          onReturned={refreshAll}
        />
      )}

      {activeTab === "my-borrows" && (
        <MyBorrows active={active} history={history} onRefresh={refreshAll} />
      )}

      {activeTab === "fines" && (
        <MyFines summary={fines} borrows={borrows} onRefresh={refreshAll} />
      )}
    </div>
  );
}