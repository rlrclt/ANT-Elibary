"use client";

import { useState } from "react";
import Link from "next/link";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import type { BorrowHistoryRecord } from "../actions";

type HistoryClientProps = {
  initialRecords: BorrowHistoryRecord[];
  error: string | null;
};

type TabKey = "history" | "analytics" | "late-returns";
type TimePeriod = "day" | "month" | "year";

export function HistoryClient({ initialRecords, error: initialError }: HistoryClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("history");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [records, setRecords] = useState<BorrowHistoryRecord[]>(initialRecords);
  
  // Analytics Time Period Grouping
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("day");

  // Pagination for history table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter records based on search and status
  const filteredRecords = records.filter((rec) => {
    const title = rec.book_copy?.book?.title || "";
    const barcode = rec.book_copy?.barcode || "";
    const userName = rec.user?.full_name || "";
    const userCode = rec.user?.user_id_code || "";
    const dept = rec.user?.department || "";
    
    const matchesSearch = 
      title.toLowerCase().includes(search.toLowerCase()) ||
      barcode.toLowerCase().includes(search.toLowerCase()) ||
      userName.toLowerCase().includes(search.toLowerCase()) ||
      userCode.toLowerCase().includes(search.toLowerCase()) ||
      dept.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || rec.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Status badges formatter
  const renderStatusBadge = (status: string) => {
    if (status === "returned") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-meb-green bg-meb-light rounded-full border border-meb-green/10">
          <span className="w-1.5 h-1.5 rounded-full bg-meb-green" />
          คืนแล้ว
        </span>
      );
    }
    if (status === "overdue") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-price-red bg-red-50 dark:bg-red-500/10 rounded-full border border-price-red/10 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-price-red" />
          เกินกำหนด
        </span>
      );
    }
    if (status === "lost") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-500 bg-slate-100 rounded-full border border-slate-300/30">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          สูญหาย
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 rounded-full border border-blue-600/10">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        กำลังยืม
      </span>
    );
  };

  // -------------------------------------------------------------
  // CALCULATE ANALYTICS
  // -------------------------------------------------------------
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 1. Borrowed & Returned today
  const borrowedTodayList = records.filter((rec) => {
    const borrowDate = new Date(rec.borrowed_at);
    return borrowDate >= startOfToday;
  });
  
  const returnedTodayList = records.filter((rec) => {
    if (!rec.returned_at) return false;
    const returnDate = new Date(rec.returned_at);
    return returnDate >= startOfToday;
  });

  // 2. Department Borrows count
  const deptBorrowsMap: Record<string, number> = {};
  records.forEach((rec) => {
    const dept = rec.user?.department || "ไม่ระบุแผนก";
    deptBorrowsMap[dept] = (deptBorrowsMap[dept] || 0) + 1;
  });
  
  const sortedDepts = Object.entries(deptBorrowsMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
    
  const maxDeptBorrows = sortedDepts.length > 0 ? sortedDepts[0].count : 1;

  // 3. Gender Borrows count
  const genderBorrowsMap: Record<string, number> = { male: 0, female: 0, other: 0, not_specified: 0 };
  records.forEach((rec) => {
    const g = rec.user?.gender || "not_specified";
    genderBorrowsMap[g] = (genderBorrowsMap[g] || 0) + 1;
  });
  const totalGenderBorrows = Object.values(genderBorrowsMap).reduce((a, b) => a + b, 0) || 1;

  // 4. Time series grouping
  const timeSeriesMap: Record<string, number> = {};
  records.forEach((rec) => {
    const date = new Date(rec.borrowed_at);
    let key = "";
    if (timePeriod === "day") {
      key = date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
    } else if (timePeriod === "month") {
      key = date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    } else {
      key = `ปีการศึกษา B.E. ${date.getFullYear() + 543}`;
    }
    timeSeriesMap[key] = (timeSeriesMap[key] || 0) + 1;
  });

  const timeSeriesList = Object.entries(timeSeriesMap).map(([period, count]) => ({
    period,
    count,
  }));

  // 5. Late returns list (Overdue)
  const lateReturnList = records.filter(
    (rec) => rec.status === "overdue" || (rec.status === "borrowing" && new Date(rec.due_date) < now)
  );

  const totalOutstandingFines = records
    .filter((rec) => rec.status === "overdue" || rec.status === "lost" || rec.fine_amount > 0)
    .reduce((sum, rec) => sum + (rec.fine_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-border-base pb-4">
          <div className="flex items-center gap-2.5">
            <Link
              href="/staff/books"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
              title="ย้อนกลับไปหน้าจัดการหนังสือ"
            >
              <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
            </Link>
            <PhosphorIcon name="chart-pie-slice" weight="fill" className="text-2xl text-meb-green" />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100 leading-tight">
                ประวัติและรายงานการยืม-คืน
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                วิเคราะห์สถิติจำนวนการยืม รายงานคนคืนช้า และประวัติธุรกรรมห้องสมุดทั้งหมด
              </p>
            </div>
          </div>
        </div>

        {/* Tab triggers */}
        <div className="flex border-b border-gray-100 dark:border-border-base mt-4 -mb-5">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition border-b-2 -mb-px ${
              activeTab === "history"
                ? "border-meb-green text-meb-green"
                : "border-transparent text-slate-500 hover:text-forest dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <PhosphorIcon name="clock-counter-clockwise" />
            ประวัติการยืม-คืนทั้งหมด
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition border-b-2 -mb-px ${
              activeTab === "analytics"
                ? "border-meb-green text-meb-green"
                : "border-transparent text-slate-500 hover:text-forest dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <PhosphorIcon name="presentation-chart" />
            การวิเคราะห์ & สถิติ
          </button>
          <button
            onClick={() => setActiveTab("late-returns")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition border-b-2 -mb-px ${
              activeTab === "late-returns"
                ? "border-meb-green text-meb-green"
                : "border-transparent text-slate-500 hover:text-forest dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <PhosphorIcon name="warning-diamond" />
            รายงานคืนล่าช้า & ค่าปรับ
            {lateReturnList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-price-red text-white rounded-full leading-none font-bold animate-pulse">
                {lateReturnList.length}
              </span>
            )}
          </button>
        </div>
      </section>

      {initialError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 text-price-red rounded-xl border border-red-200 dark:border-red-900/30">
          <PhosphorIcon name="warning-circle" weight="fill" />
          <span>เกิดข้อผิดพลาดในการโหลดข้อมูล: {initialError}</span>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 1: ALL HISTORY TABLE
          ------------------------------------------------------------- */}
      {activeTab === "history" && (
        <section className="bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <PhosphorIcon
                name="magnifying-glass"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ค้นหารหัสสมาชิก, ชื่อผู้ยืม, แผนกวิชา, รหัสหนังสือ หรือบาร์โค้ด..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-xl outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 transition"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-xl outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 transition shrink-0"
            >
              <option value="all">ทุกสถานะยืม-คืน</option>
              <option value="borrowing">กำลังยืม</option>
              <option value="returned">คืนแล้ว</option>
              <option value="overdue">เกินกำหนด</option>
              <option value="lost">สูญหาย</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-border-base bg-gray-50/50 dark:bg-white/[0.02]">
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">หนังสือ</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">ผู้ยืม</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">วันที่ยืม ➔ กำหนดคืน</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">วันที่คืน</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider text-center">สถานะ</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider text-right">ค่าปรับ</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      <PhosphorIcon name="file-search" className="mx-auto text-3xl opacity-50 mb-2" />
                      ไม่มีประวัติการยืม-คืน
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((rec) => (
                    <tr key={rec.id} className="border-b border-gray-50 dark:border-border-base/50 hover:bg-gray-50/30 dark:hover:bg-white/[0.01] transition-colors">
                      <td className="px-4 py-4 min-w-[220px]">
                        <div className="flex gap-3 items-center">
                          {rec.book_copy?.book?.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rec.book_copy.book.cover_image_url}
                              alt={rec.book_copy.book.title}
                              className="w-10 h-14 object-cover rounded shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded bg-gray-100 dark:bg-white/10 flex items-center justify-center text-slate-400 shrink-0">
                              <PhosphorIcon name="book-open" className="text-lg" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={rec.book_copy?.book?.title}>
                              {rec.book_copy?.book?.title || "—"}
                            </p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              Barcode: {rec.book_copy?.barcode || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 min-w-[180px]">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {rec.user?.full_name || "ไม่ระบุชื่อ"}
                        </p>
                        <p className="text-xs text-slate-400">
                          ID: {rec.user?.user_id_code || "—"} • {rec.user?.department || "บุคคลภายนอก"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs min-w-[150px]">
                        <p className="font-medium text-slate-600 dark:text-slate-300">
                          {new Date(rec.borrowed_at).toLocaleDateString("th-TH")}
                        </p>
                        <p className="text-slate-400 mt-0.5">
                          ➔ {new Date(rec.due_date).toLocaleDateString("th-TH")}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-400 min-w-[100px]">
                        {rec.returned_at ? (
                          new Date(rec.returned_at).toLocaleDateString("th-TH")
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center min-w-[110px]">
                        {renderStatusBadge(rec.status)}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-800 dark:text-slate-200 min-w-[80px]">
                        {rec.fine_amount > 0 ? (
                          <span className="text-price-red font-mono">฿{rec.fine_amount.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-border-base/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                แสดง {(currentPage - 1) * itemsPerPage + 1} ถึง {Math.min(currentPage * itemsPerPage, filteredRecords.length)} จาก {filteredRecords.length} รายการ
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((c) => Math.max(c - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 dark:border-border-base text-slate-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-white/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PhosphorIcon name="caret-left" weight="bold" />
                </button>
                <span className="text-sm font-bold text-forest dark:text-slate-200 px-3">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((c) => Math.min(c + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 dark:border-border-base text-slate-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-white/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PhosphorIcon name="caret-right" weight="bold" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* -------------------------------------------------------------
          TAB 2: ANALYTICS & STATS DASHBOARD
          ------------------------------------------------------------- */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Mini Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-card-bg p-5 rounded-2xl border border-gray-100 dark:border-border-base flex items-center gap-4 transition shadow-sm">
              <div className="w-12 h-12 bg-meb-light text-meb-green rounded-full flex items-center justify-center text-2xl shrink-0">
                <PhosphorIcon name="books" weight="fill" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                  {borrowedTodayList.length}
                </p>
                <p className="text-xs text-slate-400 font-medium">ยืมหนังสือวันนี้</p>
              </div>
            </div>
            <div className="bg-white dark:bg-card-bg p-5 rounded-2xl border border-gray-100 dark:border-border-base flex items-center gap-4 transition shadow-sm">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-full flex items-center justify-center text-2xl shrink-0">
                <PhosphorIcon name="arrow-u-up-left" weight="fill" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                  {returnedTodayList.length}
                </p>
                <p className="text-xs text-slate-400 font-medium">คืนหนังสือวันนี้</p>
              </div>
            </div>
            <div className="bg-white dark:bg-card-bg p-5 rounded-2xl border border-gray-100 dark:border-border-base flex items-center gap-4 transition shadow-sm">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950 text-price-red rounded-full flex items-center justify-center text-2xl shrink-0">
                <PhosphorIcon name="warning-diamond" weight="fill" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                  {lateReturnList.length}
                </p>
                <p className="text-xs text-slate-400 font-medium">ค้างส่งล่าช้า</p>
              </div>
            </div>
            <div className="bg-white dark:bg-card-bg p-5 rounded-2xl border border-gray-100 dark:border-border-base flex items-center gap-4 transition shadow-sm">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-full flex items-center justify-center text-2xl shrink-0">
                <PhosphorIcon name="coin" weight="fill" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                  ฿{totalOutstandingFines.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 font-medium">ค่าปรับค้างสะสมทั้งหมด</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List of borrowers today */}
            <div className="lg:col-span-1 bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base rounded-2xl shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-forest dark:text-slate-100 flex items-center gap-2">
                  <PhosphorIcon name="user-check" weight="fill" className="text-meb-green" />
                  รายชื่อผู้ยืมในวันนี้ ({borrowedTodayList.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">รายชื่อและเวลาที่เข้ายืมหนังสือในรอบวัน</p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {borrowedTodayList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">วันนี้ยังไม่มีผู้ยืมหนังสือ</p>
                ) : (
                  borrowedTodayList.map((rec) => (
                    <div key={rec.id} className="flex justify-between items-start gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100/50 dark:border-border-base">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {rec.user?.full_name || "ไม่ระบุชื่อ"}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {rec.book_copy?.book?.title || "—"}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-white dark:bg-white/5 border border-gray-200/50 dark:border-border-base px-2 py-0.5 rounded-md shrink-0">
                        {new Date(rec.borrowed_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top borrowing departments */}
            <div className="lg:col-span-1 bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base rounded-2xl shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-forest dark:text-slate-100 flex items-center gap-2">
                  <PhosphorIcon name="ranking" weight="fill" className="text-meb-green" />
                  แผนกที่ยืมเยอะที่สุด
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">วิเคราะห์สัดส่วนความต้องการหนังสือตามแผนกวิชา</p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {sortedDepts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">ไม่มีข้อมูลสถิติแผนก</p>
                ) : (
                  sortedDepts.map((d, index) => {
                    const widthPercent = `${Math.max(10, (d.count / maxDeptBorrows) * 100)}%`;
                    return (
                      <div key={d.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                            {index + 1}. {d.name}
                          </span>
                          <span className="text-slate-800 dark:text-white font-mono font-black">{d.count} เล่ม</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-meb-green to-meb-hover rounded-full transition-all duration-500" 
                            style={{ width: widthPercent }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Gender borrows demographics */}
            <div className="lg:col-span-1 bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base rounded-2xl shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-forest dark:text-slate-100 flex items-center gap-2">
                  <PhosphorIcon name="users-three" weight="fill" className="text-meb-green" />
                  สถิติตามเพศผู้ใช้งาน (Demographics)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">สัดส่วนเพศของนักศึกษาที่มาใช้บริการห้องสมุด</p>
              </div>

              <div className="space-y-4">
                <GenderBar label="ชาย (Male)" count={genderBorrowsMap.male} total={totalGenderBorrows} color="bg-blue-500" />
                <GenderBar label="หญิง (Female)" count={genderBorrowsMap.female} total={totalGenderBorrows} color="bg-pink-500" />
                <GenderBar label="อื่นๆ (Other)" count={genderBorrowsMap.other} total={totalGenderBorrows} color="bg-purple-500" />
                <GenderBar label="ไม่ระบุเพศ" count={genderBorrowsMap.not_specified} total={totalGenderBorrows} color="bg-slate-400" />
              </div>
            </div>
          </div>

          {/* Time Series Summary */}
          <div className="bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-forest dark:text-slate-100 flex items-center gap-2">
                  <PhosphorIcon name="calendar-blank" weight="fill" className="text-meb-green" />
                  ยอดการยืมจำแนกตามระยะเวลา (Time Series)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">สรุปยอดรวมของจำนวนการเข้ายืมหนังสือในมิติต่างๆ</p>
              </div>

              <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setTimePeriod("day")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    timePeriod === "day"
                      ? "bg-white dark:bg-card-bg text-meb-green shadow-sm"
                      : "text-slate-500 hover:text-forest dark:text-slate-400"
                  }`}
                >
                  รายวัน
                </button>
                <button
                  onClick={() => setTimePeriod("month")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    timePeriod === "month"
                      ? "bg-white dark:bg-card-bg text-meb-green shadow-sm"
                      : "text-slate-500 hover:text-forest dark:text-slate-400"
                  }`}
                >
                  รายเดือน
                </button>
                <button
                  onClick={() => setTimePeriod("year")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    timePeriod === "year"
                      ? "bg-white dark:bg-card-bg text-meb-green shadow-sm"
                      : "text-slate-500 hover:text-forest dark:text-slate-400"
                  }`}
                >
                  รายปี (ปีการศึกษา)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {timeSeriesList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 col-span-full">ไม่มีข้อมูลประวัติยืม</p>
              ) : (
                timeSeriesList.map((ts) => (
                  <div key={ts.period} className="p-3 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-border-base rounded-xl text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-semibold">{ts.period}</p>
                    <p className="text-xl font-black text-meb-green mt-1">{ts.count} เล่ม</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: LATE RETURNS & FINES REPORT
          ------------------------------------------------------------- */}
      {activeTab === "late-returns" && (
        <section className="bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2">
              <PhosphorIcon name="shield-warning" weight="fill" className="text-price-red" />
              รายงานคนคืนช้า (Overdue Returns)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              รายชื่อนักศึกษาที่ถือหนังสือเกินกำหนดส่งคืน พร้อมมูลค่าค่าปรับค้างจ่าย ณ ปัจจุบัน
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-border-base bg-gray-50/50 dark:bg-white/[0.02]">
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">หนังสือ</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">ผู้ยืม</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">กำหนดส่งคืน</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider text-center">จำนวนวันที่เลย</th>
                  <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider text-right">ค่าปรับค้างสะสม</th>
                </tr>
              </thead>
              <tbody>
                {lateReturnList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      <PhosphorIcon name="shield-check" className="mx-auto text-3xl text-meb-green opacity-70 mb-2" />
                      ไม่มีผู้ค้างส่งหนังสือคืนในระบบ
                    </td>
                  </tr>
                ) : (
                  lateReturnList.map((rec) => {
                    const dueDate = new Date(rec.due_date);
                    const overDays = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={rec.id} className="border-b border-gray-50 dark:border-border-base/50 hover:bg-gray-50/30 dark:hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-4 min-w-[200px]">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {rec.book_copy?.book?.title || "—"}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">
                            Barcode: {rec.book_copy?.barcode || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {rec.user?.full_name || "ไม่ระบุชื่อ"}
                          </p>
                          <p className="text-xs text-slate-400">
                            ID: {rec.user?.user_id_code || "—"} • {rec.user?.department || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {dueDate.toLocaleDateString("th-TH")}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-price-red font-mono">
                          {Math.max(1, overDays)} วัน
                        </td>
                        <td className="px-4 py-4 text-right font-black text-price-red font-mono">
                          ฿{(rec.fine_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// HELPER DEMOGRAPHIC ROW
// -------------------------------------------------------------
function GenderBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span className="font-bold text-slate-800 dark:text-white">
          {count} ({percent.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
