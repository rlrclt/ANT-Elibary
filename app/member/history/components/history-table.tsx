"use client";

import { useState } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { Modal } from "@/app/components/modal";

/** ข้อมูลแถวประวัติยืม-คืน (ตรงกับ v_borrow_records_detail) */
export type HistoryRecord = {
  borrow_record_id: string;
  book_title: string;
  book_author: string | null;
  copy_code: string;
  cover_image_url: string | null;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: string;
  fine_amount: number;
  fine_reason: string | null;
};

type HistoryTableProps = {
  records: HistoryRecord[];
};

/** แปลงวันที่ dd MMM yyyy (ไม่ใช้ toLocaleDateString เพื่อป้องกัน hydration mismatch) */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear() + 543;
  return `${dd} ${mm} ${yyyy}`;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  borrowed: { label: "กำลังยืม", class: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" },
  returned: { label: "คืนแล้ว", class: "bg-emerald-50 dark:bg-emerald-950/20 text-meb-green border-emerald-100 dark:border-emerald-900/30" },
  lost: { label: "สูญหาย", class: "bg-red-50 dark:bg-red-950/20 text-price-red border-red-100 dark:border-red-900/30" },
  damaged: { label: "ชำรุด", class: "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30" },
};

const FINE_REASON_LABEL: Record<string, string> = {
  overdue: "คืนช้า",
  damaged: "ชำรุด",
  lost: "สูญหาย",
  other: "อื่นๆ",
};

/**
 * HistoryTable — ตารางประวัติยืม-คืน
 * คลิกแถวที่มีค่าปรับ → เปิด modal ดูรายละเอียด
 */
export function HistoryTable({ records }: HistoryTableProps) {
  const [selected, setSelected] = useState<HistoryRecord | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">หนังสือ</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">บาร์โค้ด</th>
              <th className="px-4 py-3 font-medium">วันที่ยืม</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">กำหนดคืน</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">วันที่คืน</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium text-right">ค่าปรับ</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const hasFine = record.fine_amount > 0;
              const badge = STATUS_BADGE[record.status] ?? { label: record.status, class: "bg-gray-50 text-gray-500 border" };
              return (
                <tr
                  key={record.borrow_record_id}
                  onClick={() => hasFine && setSelected(record)}
                  className={`border-b border-gray-50 dark:border-border-base/40 transition-colors ${
                    hasFine ? "cursor-pointer hover:bg-red-50/30 dark:hover:bg-red-900/10" : ""
                  }`}
                >
                  <td className="py-4 px-4 min-w-[200px]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-12 rounded overflow-hidden bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base shrink-0 flex items-center justify-center">
                        {record.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={record.cover_image_url} alt={record.book_title} className="w-full h-full object-cover" />
                        ) : (
                          <PhosphorIcon name="book" className="text-xl text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs md:text-sm">
                          {record.book_title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {record.book_author || "ไม่ระบุผู้แต่ง"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-xs hidden md:table-cell">
                    {record.copy_code}
                  </td>
                  <td className="py-4 px-4 text-xs whitespace-nowrap">
                    {formatDate(record.borrowed_at)}
                  </td>
                  <td className="py-4 px-4 text-xs whitespace-nowrap hidden md:table-cell">
                    {formatDate(record.due_date)}
                  </td>
                  <td className="py-4 px-4 text-xs whitespace-nowrap hidden md:table-cell">
                    {formatDate(record.returned_at)}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${badge.class}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-xs whitespace-nowrap">
                    {hasFine ? (
                      <span className="text-price-red inline-flex items-center gap-1">
                        ฿{Number(record.fine_amount).toFixed(2)}
                        <PhosphorIcon name="caret-left" weight="bold" className="text-[10px] text-slate-400" />
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal รายละเอียดค่าปรับ */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="รายละเอียดค่าปรับ"
        size="sm"
      >
        {selected && (
          <div className="space-y-4">
            {/* ข้อมูลหนังสือ */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-black/20 rounded-lg p-3">
              <div className="w-10 h-14 rounded overflow-hidden border border-gray-200 dark:border-border-base shrink-0 bg-gray-100 flex items-center justify-center">
                {selected.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.cover_image_url} alt={selected.book_title} className="w-full h-full object-cover" />
                ) : (
                  <PhosphorIcon name="book" className="text-slate-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {selected.book_title}
                </p>
                <p className="text-xs font-mono text-meb-green">{selected.copy_code}</p>
              </div>
            </div>

            {/* รายละเอียด */}
            <dl className="space-y-2 text-sm">
              <Row label="วันที่ยืม" value={formatDate(selected.borrowed_at)} />
              <Row label="กำหนดคืน" value={formatDate(selected.due_date)} />
              <Row label="วันที่คืน" value={formatDate(selected.returned_at)} />
              <Row
                label="เหตุผลค่าปรับ"
                value={FINE_REASON_LABEL[selected.fine_reason ?? ""] ?? selected.fine_reason ?? "—"}
              />
              <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-border-base">
                <dt className="text-sm text-slate-500 dark:text-slate-400">ค่าปรับที่ค้างชำระ</dt>
                <dd className="text-lg font-bold text-price-red">
                  ฿{Number(selected.fine_amount).toFixed(2)}
                </dd>
              </div>
            </dl>

            <button
              onClick={() => setSelected(null)}
              className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
            >
              ปิด
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Row — แถว label + value */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-border-base/40">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}