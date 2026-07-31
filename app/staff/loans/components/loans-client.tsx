"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  getActiveBorrowsAction,
  type BorrowRecord,
  type LoanStats,
} from "../actions";
import { ActiveLoansTable } from "./active-loans-table";
import { BorrowModal } from "./borrow-modal";
import { ReturnModal } from "./return-modal";
import { LoanDetailDrawer } from "./loan-detail-drawer";

type LoansClientProps = {
  initialRecords: BorrowRecord[];
  initialStats: LoanStats;
};

/**
 * LoansClient — client-side controller สำหรับ /staff/loans
 * จัดการ state: search/filter, modals, drawer, refresh ข้อมูล
 */
export function LoansClient({ initialRecords, initialStats }: LoansClientProps) {
  const [records, setRecords] = useState(initialRecords);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "borrowing" | "overdue">("all");
  const [pending, startTransition] = useTransition();

  // drawer + modals
  const [selectedRecord, setSelectedRecord] = useState<BorrowRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  // ค้นหา/กรองรายการยืม
  function handleSearch() {
    startTransition(async () => {
      const result = await getActiveBorrowsAction({
        search: search || undefined,
        status: statusFilter,
      });
      if (result.data) setRecords(result.data);
    });
  }

  // คลิกแถว → เปิด drawer
  function handleRowClick(record: BorrowRecord) {
    setSelectedRecord(record);
    setDrawerOpen(true);
  }

  // ปิด modal แล้ว refresh ข้อมูล
  function handleCloseBorrowModal() {
    setBorrowModalOpen(false);
    startTransition(async () => {
      const [recordsRes, statsRes] = await Promise.all([
        getActiveBorrowsAction({ status: statusFilter, search: search || undefined }),
        import("../actions").then((m) => m.getLoanStatsAction()),
      ]);
      if (recordsRes.data) setRecords(recordsRes.data);
      if (statsRes.data) setStats(statsRes.data);
    });
  }

  function handleCloseReturnModal() {
    setReturnModalOpen(false);
    startTransition(async () => {
      const [recordsRes, statsRes] = await Promise.all([
        getActiveBorrowsAction({ status: statusFilter, search: search || undefined }),
        import("../actions").then((m) => m.getLoanStatsAction()),
      ]);
      if (recordsRes.data) setRecords(recordsRes.data);
      if (statsRes.data) setStats(statsRes.data);
    });
  }

  // ปิด drawer แล้ว refresh (หากมีการเปลี่ยนแปลง เช่น ต่ออายุ/คืน/สูญหาย)
  function handleCloseDrawer() {
    setDrawerOpen(false);
    startTransition(async () => {
      const [recordsRes, statsRes] = await Promise.all([
        getActiveBorrowsAction({ status: statusFilter, search: search || undefined }),
        import("../actions").then((m) => m.getLoanStatsAction()),
      ]);
      if (recordsRes.data) setRecords(recordsRes.data);
      if (statsRes.data) setStats(statsRes.data);
    });
  }

  return (
    <>
      {/* Header + Stats + Actions (2 คอลัมน์: ซ้าย 60% stats, ขวา 40% actions) */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อหน้า */}
        <div className="flex items-center gap-2.5 mb-5">
          <Link
            href="/staff"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
            title="ย้อนกลับไปหน้าเจ้าหน้าที่"
          >
            <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
          </Link>
          <PhosphorIcon name="arrow-clock" weight="fill" className="text-2xl text-meb-green" />
          <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
            ยืม-คืนหนังสือ
          </h1>
        </div>

        {/* 2 คอลัมน์: ซ้าย 60% (stats 2x2) | ขวา 40% (actions 2x2) */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* ซ้าย — Stats 2x2 (60%) */}
          <div className="lg:w-3/5 grid grid-cols-2 gap-3">
            <StatMiniCard
              icon="book-open"
              label="กำลังยืม"
              value={stats.active}
              color="bg-meb-light text-meb-green"
            />
            <StatMiniCard
              icon="warning"
              label="เกินกำหนด"
              value={stats.overdue}
              color="bg-red-50 text-price-red"
            />
            <StatMiniCard
              icon="check-circle"
              label="คืนวันนี้"
              value={stats.returnedToday}
              color="bg-blue-50 text-blue-600"
            />
            <StatMiniCard
              icon="currency-dollar"
              label="ค่าปรับรวม"
              value={`฿${stats.totalFines.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
              color="bg-amber-50 text-amber-600"
            />
          </div>

          {/* ขวา — Actions 2x2 (40%) */}
          <div className="lg:w-2/5 grid grid-cols-2 gap-3">
            <ActionButton
              icon="arrow-counter-clockwise"
              label="ยืมหนังสือ"
              onClick={() => setBorrowModalOpen(true)}
              variant="primary"
            />
            <ActionButton
              icon="arrow-u-up-left"
              label="คืนหนังสือ"
              onClick={() => setReturnModalOpen(true)}
              variant="secondary"
            />
            <ActionButton
              icon="magnifying-glass"
              label="ค้นหา"
              onClick={handleSearch}
              variant="secondary"
            />
            <ActionButton
              icon="chart-bar"
              label="วิเคราะห์"
              onClick={() => {/* TODO: หน้าวิเคราะห์ */}}
              variant="secondary"
            />
          </div>
        </div>
      </section>

      {/* Active loans table (มี search ในตารางเอง) */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* Search + filter — ในบรรทัดเดียว เพื่อประหยัดพื้นที่ */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <PhosphorIcon
              name="magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="ค้นหา ชื่อสมาชิก รหัสสมาชิก หรือบาร์โค้ด..."
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value as "all" | "borrowing" | "overdue";
              setStatusFilter(v);
              startTransition(async () => {
                const r = await getActiveBorrowsAction({
                  search: search || undefined,
                  status: v,
                });
                if (r.data) setRecords(r.data);
              });
            }}
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100 shrink-0"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="borrowing">กำลังยืม</option>
            <option value="overdue">เกินกำหนด</option>
          </select>
        </div>

        {pending && records.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="circle-notch" className="text-2xl animate-spin mr-2" />
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        ) : (
          <ActiveLoansTable records={records} onRowClick={handleRowClick} />
        )}
      </section>

      {/* Modals */}
      <BorrowModal
        open={borrowModalOpen}
        onClose={handleCloseBorrowModal}
      />
      <ReturnModal
        open={returnModalOpen}
        onClose={handleCloseReturnModal}
      />

      {/* Drawer */}
      <LoanDetailDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        record={selectedRecord}
      />
    </>
  );
}

/** StatMiniCard — การ์ดสถิติเล็กๆ สำหรับ 2x2 grid */
function StatMiniCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-border-base">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <PhosphorIcon name={icon} weight="fill" className="text-xl" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-lg font-bold text-forest dark:text-slate-100 truncate">{value}</p>
      </div>
    </div>
  );
}

/** ActionButton — ปุ่ม action สำหรับ 2x2 grid */
function ActionButton({
  icon,
  label,
  onClick,
  variant,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  variant: "primary" | "secondary";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 transition h-full ${
        variant === "primary"
          ? "border-meb-green bg-meb-light text-meb-green hover:bg-meb-light/70"
          : "border-gray-200 dark:border-border-base text-slate-600 dark:text-slate-300 hover:border-meb-green/30 hover:bg-gray-50 dark:hover:bg-white/5"
      }`}
    >
      <PhosphorIcon name={icon} weight="bold" className="text-2xl" />
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}