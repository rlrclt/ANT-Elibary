"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../../components/phosphor-icon";
import type { ReportBook, ReportCategory } from "../actions";

type ReportsClientProps = {
  initialBooks: ReportBook[];
  categories: ReportCategory[];
  error: string | null;
};

type TabKey = "summary" | "registration";

/**
 * ReportsClient — หน้ารายงานหนังสือ (/staff/books/reports)
 * - Tab สรุป: จำนวนหนังสือทั้งหมด แยกเก่า/ใหม่ และตามหมวดหมู่
 * - Tab การลงทะเบียน: นับหนังสือที่ลงทะเบียนนำเข้า (created_at) ตามวัน/เดือน/ปี แยกหมวดหมู่
 * - ปุ่ม export: PDF (jsPDF) / CSV (Blob) / Excel (xlsx)
 */
export function ReportsClient({ initialBooks, categories, error: initialError }: ReportsClientProps) {
  const [tab, setTab] = useState<TabKey>("summary");
  const [period, setPeriod] = useState<"day" | "month" | "year">("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error] = useState<string | null>(initialError);

  const books = initialBooks;

  // ---------- ข้อมูลแท็บ 1: สรุป ----------
  const summary = useMemo(() => {
    const total = books.length;
    const oldCount = books.filter((b) => b.is_old).length;
    const newCount = total - oldCount;

    // แยกตามหมวดหมู่
    const catMap = new Map<
      string,
      { name: string; color: string | null; total: number; old: number; newCount: number }
    >();
    for (const b of books) {
      const key = b.category_id ?? "none";
      const entry = catMap.get(key) ?? {
        name: b.category_name ?? "ไม่ระบุหมวด",
        color: null,
        total: 0,
        old: 0,
        newCount: 0,
      };
      entry.total += 1;
      if (b.is_old) entry.old += 1;
      else entry.newCount += 1;
      catMap.set(key, entry);
    }

    return {
      total,
      oldCount,
      newCount,
      byCategory: Array.from(catMap.entries()).map(([, v]) => v).sort((a, b) => b.total - a.total),
    };
  }, [books]);

  // ---------- ข้อมูลแท็บ 2: การลงทะเบียนนำเข้า ----------
  const regRows = useMemo(() => {
    let filtered = books;
    if (fromDate) {
      const f = new Date(fromDate);
      filtered = filtered.filter((b) => new Date(b.created_at) >= f);
    }
    if (toDate) {
      const t = new Date(toDate);
      t.setHours(23, 59, 59, 999);
      filtered = filtered.filter((b) => new Date(b.created_at) <= t);
    }

    // สร้าง key ตาม period
    const keyFn = (iso: string) => {
      const d = new Date(iso);
      if (period === "day") {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      if (period === "year") return String(d.getFullYear());
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const labelFn = (key: string) => {
      if (period === "day") {
        const [y, m, d] = key.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("th-TH", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
      if (period === "year") return `ปี ${Number(key) + 543}`;
      const [y, m] = key.split("-").map(Number);
      return `${m}/${y + 543}`;
    };

    // pivot: แถว = ช่วงเวลา, คอลัมน์ = หมวดหมู่
    const periodMap = new Map<string, { label: string; byCat: Map<string, number>; total: number }>();
    for (const b of filtered) {
      const key = keyFn(b.created_at);
      let entry = periodMap.get(key);
      if (!entry) {
        entry = { label: labelFn(key), byCat: new Map(), total: 0 };
        periodMap.set(key, entry);
      }
      entry.total += 1;
      const catKey = b.category_id ?? "none";
      entry.byCat.set(catKey, (entry.byCat.get(catKey) ?? 0) + 1);
    }

    return {
      rows: Array.from(periodMap.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([, v]) => v),
      catList: categories,
    };
  }, [books, period, fromDate, toDate, categories]);

  const catLabel = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "ไม่ระบุหมวด";

  // ---------- Export helpers ----------
  function buildSummaryRows(): string[][] {
    const header = ["หมวดหมู่", "ใหม่ (อายุไม่ถึง 5 ปี)", "เก่า (5 ปีขึ้นไป)", "รวม"];
    const rows = summary.byCategory.map((c) => [
      c.name,
      String(c.newCount),
      String(c.old),
      String(c.total),
    ]);
    rows.push(["รวมทั้งหมด", String(summary.newCount), String(summary.oldCount), String(summary.total)]);
    return [header, ...rows];
  }

  function buildRegistrationRows(): string[][] {
    const header = [
      "ช่วงเวลา",
      ...regRows.catList.map((c) => c.name),
      "รวม",
    ];
    const rows = regRows.rows.map((r) => [
      r.label,
      ...regRows.catList.map((c) => String(r.byCat.get(c.id) ?? 0)),
      String(r.total),
    ]);
    return [header, ...rows];
  }

  async function exportCSV(build: () => string[][], filename: string) {
    const rows = build();
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel(build: () => string[][], filename: string) {
    const { utils, writeFile } = await import("xlsx");
    const ws = utils.aoa_to_sheet(build());
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "รายงานหนังสือ");
    writeFile(wb, filename);
  }

  async function exportPDF(build: () => string[][], filename: string, title: string) {
    const rows = build();
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`ออกรายงาน: ${new Date().toLocaleString("th-TH")}`, 14, 20);

    const colCount = rows[0].length;
    const pageW = 297;
    const margin = 12;
    const avail = pageW - margin * 2;
    const colW = Math.max(15, Math.min(60, avail / colCount));
    const startY = 28;
    const rowH = 6;

    let y = startY;
    rows.forEach((row, rowIdx) => {
      // หน้าใหม่ถ้าเกิน
      if (y > 200) {
        doc.addPage();
        y = startY;
      }
      if (rowIdx === 0) {
        doc.setFillColor(0, 166, 81);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFillColor(rowIdx % 2 === 0 ? 240 : 255, rowIdx % 2 === 0 ? 250 : 255, rowIdx % 2 === 0 ? 244 : 255);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "normal");
      }
      let x = margin;
      row.forEach((cell, ci) => {
        doc.rect(x, y, colW, rowH, "F");
        doc.text(String(cell).slice(0, 40), x + 2, y + 4);
        x += colW;
      });
      y += rowH;
    });

    doc.save(filename);
  }

  return (
    <>
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อ */}
        <div className="flex items-center gap-2.5 mb-4">
          <Link
            href="/staff/books"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
            title="ย้อนกลับไปจัดการหนังสือ"
          >
            <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
          </Link>
          <PhosphorIcon name="chart-bar" weight="fill" className="text-2xl text-meb-green" />
          <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
            รายงานหนังสือ
          </h1>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-price-red mb-4">
            <PhosphorIcon name="warning" weight="fill" />
            {error}
          </div>
        )}

        {/* Tab switch */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")} icon="pie-chart" label="สรุปหนังสือ เก่า/ใหม่" />
          <TabButton active={tab === "registration"} onClick={() => setTab("registration")} icon="calendar-dots" label="การลงทะเบียนนำเข้า" />
        </div>

        {/* ---------- Tab 1: สรุป ---------- */}
        {tab === "summary" && (
          <div>
            {/* การ์ดสรุป */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <MiniStat label="หนังสือทั้งหมด (ชื่อเรื่อง)" value={summary.total} icon="books" color="text-meb-green" />
              <MiniStat label="หนังสือใหม่ (< 5 ปี)" value={summary.newCount} icon="sparkle" color="text-blue-600" />
              <MiniStat label="หนังสือเก่า (≥ 5 ปี)" value={summary.oldCount} icon="hourglass-high" color="text-terracotta" />
            </div>

            {/* ตารางแยกตามหมวดหมู่ */}
            <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-border-base">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-medium">หมวดหมู่</th>
                    <th className="px-4 py-3 font-medium text-center">ใหม่</th>
                    <th className="px-4 py-3 font-medium text-center">เก่า</th>
                    <th className="px-4 py-3 font-medium text-center">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCategory.map((c, idx) => (
                    <tr key={idx} className="border-b border-gray-50 dark:border-border-base last:border-0">
                      <td className="px-4 py-2.5 font-medium text-forest dark:text-slate-100">{c.name}</td>
                      <td className="px-4 py-2.5 text-center">{c.newCount}</td>
                      <td className="px-4 py-2.5 text-center text-terracotta">{c.old}</td>
                      <td className="px-4 py-2.5 text-center font-bold">{c.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Export */}
            <ExportBar
              onPdf={() => exportPDF(buildSummaryRows, "summary-books.pdf", "สรุปหนังสือ เก่า/ใหม่")}
              onCsv={() => exportCSV(buildSummaryRows, "summary-books.csv")}
              onExcel={() => exportExcel(buildSummaryRows, "summary-books.xlsx")}
            />
          </div>
        )}

        {/* ---------- Tab 2: การลงทะเบียนนำเข้า ---------- */}
        {tab === "registration" && (
          <div>
            {/* ช่วงเวลา */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as "day" | "month" | "year")}
                className="px-3 py-2 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
              >
                <option value="day">รายวัน</option>
                <option value="month">รายเดือน</option>
                <option value="year">รายปี</option>
              </select>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
                title="จากวันที่"
              />
              <span className="text-slate-400 text-sm">ถึง</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
                title="ถึงวันที่"
              />
              <p className="text-xs text-slate-400">
                นับหนังสือที่ลงทะเบียนนำเข้าสู่ระบบ (created_at) แยกตามหมวดหมู่
              </p>
            </div>

            {/* ตาราง pivot */}
            <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-border-base">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-medium sticky left-0 bg-white dark:bg-card-bg">ช่วงเวลา</th>
                    {regRows.catList.map((c) => (
                      <th key={c.id} className="px-4 py-3 font-medium text-center whitespace-nowrap">{c.name}</th>
                    ))}
                    <th className="px-4 py-3 font-medium text-center">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {regRows.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={regRows.catList.length + 2}
                        className="px-4 py-8 text-center text-slate-400 text-sm"
                      >
                        ไม่มีข้อมูลในช่วงเวลาที่เลือก
                      </td>
                    </tr>
                  ) : (
                    regRows.rows.map((r, idx) => (
                      <tr key={idx} className="border-b border-gray-50 dark:border-border-base last:border-0">
                        <td className="px-4 py-2.5 font-medium text-forest dark:text-slate-100 whitespace-nowrap sticky left-0 bg-white dark:bg-card-bg">
                          {r.label}
                        </td>
                        {regRows.catList.map((c) => (
                          <td key={c.id} className="px-4 py-2.5 text-center">
                            {r.byCat.get(c.id) ?? 0}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center font-bold">{r.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Export */}
            <ExportBar
              onPdf={() => exportPDF(buildRegistrationRows, "registration-books.pdf", `การลงทะเบียนนำเข้าหนังสือ (${periodLabel(period)})`)}
              onCsv={() => exportCSV(buildRegistrationRows, "registration-books.csv")}
              onExcel={() => exportExcel(buildRegistrationRows, "registration-books.xlsx")}
            />
          </div>
        )}
      </section>
    </>
  );
}

function periodLabel(p: "day" | "month" | "year") {
  if (p === "day") return "รายวัน";
  if (p === "month") return "รายเดือน";
  return "รายปี";
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-md transition ${
        active
          ? "bg-meb-green text-white"
          : "bg-gray-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-border-base"
      }`}
    >
      <PhosphorIcon name={icon} weight={active ? "fill" : "regular"} className="text-base" />
      {label}
    </button>
  );
}

function MiniStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-border-base">
      <PhosphorIcon name={icon} weight="fill" className={`text-base ${color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-lg font-bold text-forest dark:text-slate-100 leading-none">{value}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{label}</p>
      </div>
    </div>
  );
}

function ExportBar({
  onPdf,
  onCsv,
  onExcel,
}: {
  onPdf: () => void;
  onCsv: () => void;
  onExcel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-border-base">
      <span className="text-sm text-slate-500 dark:text-slate-400 mr-1">ส่งออกรายงาน:</span>
      <button
        onClick={onPdf}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-price-red bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 rounded-md transition"
      >
        <PhosphorIcon name="file-pdf" weight="bold" />
        PDF
      </button>
      <button
        onClick={onCsv}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 rounded-md transition"
      >
        <PhosphorIcon name="file-csv" weight="bold" />
        CSV
      </button>
      <button
        onClick={onExcel}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-green-700 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 border border-green-200 dark:border-green-500/20 rounded-md transition"
      >
        <PhosphorIcon name="file-xls" weight="bold" />
        Excel
      </button>
    </div>
  );
}
