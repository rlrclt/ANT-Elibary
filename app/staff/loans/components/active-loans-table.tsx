"use client";

import { PhosphorIcon } from "../../../components/phosphor-icon";
import type { BorrowRecord } from "../actions";

/**
 * active-loans-table — ตารางรายการยืมที่ยังไม่คืน
 * คอลัมน์: สมาชิก, หนังสือ, วันที่ยืม, กำหนดคืน, สถานะ, การขยาย
 * คลิกแถว → onRowClick(record)
 */
type ActiveLoansTableProps = {
  records: BorrowRecord[];
  onRowClick: (record: BorrowRecord) => void;
};

// สี badge สถานะ
const STATUS_BADGE: Record<string, string> = {
  borrowing: "bg-meb-light text-meb-green",
  overdue: "bg-red-50 text-price-red",
  returned: "bg-blue-50 text-blue-600",
  lost: "bg-gray-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  borrowing: "กำลังยืม",
  overdue: "เกินกำหนด",
  returned: "คืนแล้ว",
  lost: "สูญหาย",
};

// ฟอร์แมตวันที่ dd/MM/yyyy
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ดึง 2 ตัวอักษรแรกของชื่อสำหรับ avatar initials
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ActiveLoansTable({ records, onRowClick }: ActiveLoansTableProps) {
  // กรณีไม่มีรายการ — โชว์ empty state
  if (records.length === 0) {
    return (
      <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-12 transition-colors">
        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
          <PhosphorIcon name="book-open" className="text-5xl mb-3" />
          <p className="text-sm">ไม่มีรายการยืมในขณะนี้</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">สมาชิก</th>
              <th className="px-4 py-3 font-medium">หนังสือ</th>
              <th className="px-4 py-3 font-medium">วันที่ยืม</th>
              <th className="px-4 py-3 font-medium">กำหนดคืน</th>
              <th className="px-4 py-3 font-medium text-center">สถานะ</th>
              <th className="px-4 py-3 font-medium text-center">การขยาย</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const isOverdue = record.status === "overdue";
              const dueDate = new Date(record.due_date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isPastDue = dueDate < today && record.status === "borrowing";
              const overdueClass = isOverdue || isPastDue ? "text-price-red font-bold" : "";

              return (
                <tr
                  key={record.id}
                  onClick={() => onRowClick(record)}
                  className="border-b border-gray-50 dark:border-border-base last:border-0 cursor-pointer hover:bg-meb-light/50 dark:hover:bg-white/5 transition-colors"
                >
                  {/* สมาชิก */}
                  <td className="px-4 py-3 min-w-[160px]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-meb-light text-meb-green flex items-center justify-center text-xs font-bold shrink-0">
                        {record.user?.full_name
                          ? getInitials(record.user.full_name)
                          : "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-forest dark:text-slate-100 truncate">
                          {record.user?.full_name ?? "-"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {record.user?.user_id_code ?? "-"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* หนังสือ */}
                  <td className="px-4 py-3 min-w-[200px]">
                    <div className="flex items-center gap-2.5">
                      {record.book_copy?.book?.cover_image_url ? (
                        <img
                          src={record.book_copy.book.cover_image_url}
                          alt={record.book_copy.book.title}
                          width={28}
                          height={40}
                          className="w-7 h-10 object-cover rounded bg-gray-100 dark:bg-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-10 rounded bg-meb-light flex items-center justify-center text-meb-green shrink-0">
                          <PhosphorIcon name="book" className="text-xs" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-forest dark:text-slate-100 truncate max-w-[180px]">
                          {record.book_copy?.book?.title ?? "-"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                          {record.book_copy?.barcode ?? "-"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* วันที่ยืม */}
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {formatDate(record.borrowed_at)}
                  </td>

                  {/* กำหนดคืน */}
                  <td className={`px-4 py-3 whitespace-nowrap ${overdueClass}`}>
                    {formatDate(record.due_date)}
                  </td>

                  {/* สถานะ */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[record.status] ?? STATUS_BADGE.borrowing}`}
                    >
                      {STATUS_LABEL[record.status] ?? record.status}
                    </span>
                  </td>

                  {/* การขยาย */}
                  <td className="px-4 py-3 text-center">
                    {record.extension_count >= 1 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                        ต่อแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-meb-light text-meb-green">
                        ต่อได้
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}