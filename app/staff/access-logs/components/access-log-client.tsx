"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  getAccessLogsAction,
  getAccessStatsAction,
  manualCheckOutAction,
  type AccessLogWithUser,
  type AccessStats,
} from "../actions";
import { AccessLogTable } from "./access-log-table";

// ฟอร์แมตระยะเวลา "X ชม. Y นาที"
function formatDuration(min: number): string {
  if (min <= 0) return "0 นาที";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

type AccessLogClientProps = {
  initialLogs: AccessLogWithUser[];
  initialStats: AccessStats;
};

/**
 * AccessLogClient — client-side controller สำหรับ /staff/access-logs
 * จัดการ state: search/filter, refresh ข้อมูล, เช็คเอาท์แทน
 */
export function AccessLogClient({ initialLogs, initialStats }: AccessLogClientProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "inside" | "checked_out">("all");
  const [pending, startTransition] = useTransition();

  // toast state (inline เนื่องจากโปรเจกต์ไม่มี toast library)
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // แสดง toast ชั่วคราว
  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // รีเฟรชข้อมูล logs + stats พร้อมกัน
  function refresh() {
    startTransition(async () => {
      const [logsRes, statsRes] = await Promise.all([
        getAccessLogsAction({
          search: search || undefined,
          status: statusFilter,
        }),
        getAccessStatsAction(),
      ]);
      if (logsRes.data) setLogs(logsRes.data);
      if (statsRes.data) setStats(statsRes.data);
    });
  }

  // ค้นหา/กรอง
  function handleSearch() {
    refresh();
  }

  // เช็คเอาท์แทนสมาชิก
  function handleManualCheckOut(logId: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("logId", logId);
      const res = await manualCheckOutAction(fd);
      if (res.error) {
        showToast("error", res.error);
      } else {
        showToast("success", "เช็คเอาท์เรียบร้อยแล้ว");
        // รีเฟรชข้อมูล
        const [logsRes, statsRes] = await Promise.all([
          getAccessLogsAction({
            search: search || undefined,
            status: statusFilter,
          }),
          getAccessStatsAction(),
        ]);
        if (logsRes.data) setLogs(logsRes.data);
        if (statsRes.data) setStats(statsRes.data);
      }
    });
  }

  return (
    <>
      {/* Header + actions */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <Link
              href="/staff"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
              title="ย้อนกลับไปหน้าเจ้าหน้าที่"
            >
              <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
            </Link>
            <PhosphorIcon name="door-open" weight="fill" className="text-2xl text-meb-green" />
            <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
              การเข้าใช้ห้องสมุด
            </h1>
          </div>
        </div>

        {/* Stats แถวเดียว 4 ช่อง กระชับ */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <MiniStat label="กำลังอยู่ในห้องสมุด" value={stats.currentlyIn.toLocaleString()} icon="door-open" color="text-meb-green" />
          <MiniStat label="เข้าวันนี้" value={stats.todayCount.toLocaleString()} icon="calendar-check" color="text-blue-600" />
          <MiniStat label="รวมเดือนนี้" value={stats.monthCount.toLocaleString()} icon="calendar" color="text-amber-600" />
          <MiniStat label="เฉลี่ยระยะเวลา" value={formatDuration(stats.avgDurationMin)} icon="clock" color="text-purple-600" isText />
        </div>

        {/* Search + filter toolbar */}
        <div className="flex flex-col sm:flex-row gap-2">
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
              placeholder="ค้นหาชื่อ/รหัสสมาชิก..."
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value as "all" | "inside" | "checked_out";
              setStatusFilter(v);
              startTransition(async () => {
                const r = await getAccessLogsAction({
                  search: search || undefined,
                  status: v,
                });
                if (r.data) setLogs(r.data);
              });
            }}
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="inside">อยู่ในห้องสมุด</option>
            <option value="checked_out">ออกแล้ว</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={pending}
            className="px-4 py-2.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md disabled:opacity-60 transition"
          >
            ค้นหา
          </button>
        </div>
      </section>

      {/* Stat cards */}

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-meb-light text-meb-green dark:bg-meb-green/10"
              : "bg-red-50 text-price-red dark:bg-red-500/10"
          }`}
        >
          <PhosphorIcon
            name={toast.type === "success" ? "check-circle" : "warning-circle"}
            weight="fill"
          />
          {toast.msg}
        </div>
      )}

      {/* Access log table */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {pending && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="circle-notch" className="text-2xl animate-spin mr-2" />
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        ) : (
          <AccessLogTable logs={logs} onManualCheckOut={handleManualCheckOut} />
        )}
      </section>
    </>
  );
}

/** MiniStat — การ์ดสถิติเล็กๆ กระชับ สำหรับแถวเดียว */
function MiniStat({
  label,
  value,
  icon,
  color,
  isText,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-border-base">
      <PhosphorIcon name={icon} weight="fill" className={`text-base ${color} shrink-0`} />
      <div className="min-w-0">
        <p className={`font-bold text-forest dark:text-slate-100 leading-none truncate ${isText ? "text-sm" : "text-lg"}`}>
          {value}
        </p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{label}</p>
      </div>
    </div>
  );
}