"use client";

import { useState } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import type { BookWithCategory } from "../actions";

const PER_PAGE = 25;

/**
 * book-table — ตารางรายการหนังสือ
 * คอลัมน์: ปก, รหัส+ชื่อ, ผู้แต่ง, หมวดหมู่, เล่มรวม/พร้อมยืม, สถานะ
 * คลิกแถว → onRowClick(book)
 * แสดง 25 รายการ/หน้า + pagination
 */
type BookTableProps = {
  books: BookWithCategory[];
  onRowClick: (book: BookWithCategory) => void;
};

// แมปสี badge สถานะเล่มแม่
const STATUS_BADGE: Record<string, string> = {
  active: "bg-meb-light text-meb-green",
  removed: "bg-gray-100 text-slate-500",
  lost: "bg-red-50 text-price-red",
  old: "bg-gray-200 dark:bg-gray-700 text-slate-600 dark:text-slate-300",
};

const STATUS_LABEL: Record<string, string> = {
  active: "ใช้งาน",
  removed: "ลบแล้ว",
  lost: "สูญหาย",
  old: "หนังสือเก่า",
};

export function BookTable({ books, onRowClick }: BookTableProps) {
  const [page, setPage] = useState(0);

  // กรณีไม่มีหนังสือ — โชว์ empty state กลางการ์ด
  if (books.length === 0) {
    return (
      <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-12 transition-colors">
        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
          <PhosphorIcon name="book-open" className="text-5xl mb-3" />
          <p className="text-sm">ไม่พบหนังสือ</p>
        </div>
      </div>
    );
  }

  // คำนวณ pagination
  const totalPages = Math.ceil(books.length / PER_PAGE);
  const pageData = books.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">ปก</th>
              <th className="px-4 py-3 font-medium">รหัส / ชื่อ</th>
              <th className="px-4 py-3 font-medium">ผู้แต่ง</th>
              <th className="px-4 py-3 font-medium">หมวดหมู่</th>
              <th className="px-4 py-3 font-medium text-center">เล่มรวม/พร้อมยืม</th>
              <th className="px-4 py-3 font-medium text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((book) => {
              const statusKey = book.status ?? "active";
              return (
                <tr
                  key={book.id}
                  onClick={() => onRowClick(book)}
                  className="border-b border-gray-50 dark:border-border-base last:border-0 cursor-pointer hover:bg-meb-light/50 dark:hover:bg-white/5 transition-colors"
                >
                  {/* ปก */}
                  <td className="px-4 py-3">
                    {book.cover_image_url ? (
                      <img
                        src={book.cover_image_url}
                        alt={book.title}
                        width={32}
                        height={44}
                        className="w-8 h-11 object-cover rounded bg-gray-100 dark:bg-white/10"
                      />
                    ) : (
                      <div className="w-8 h-11 rounded bg-meb-light flex items-center justify-center text-meb-green">
                        <PhosphorIcon name="book" />
                      </div>
                    )}
                  </td>
                  {/* รหัส + ชื่อ */}
                  <td className="px-4 py-3 min-w-[200px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-meb-green dark:text-meb-green">
                        {book.book_code}
                      </p>
                      {book.is_old_eligible && book.status !== "old" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                          <PhosphorIcon name="hourglass-high" weight="fill" className="text-[10px]" />
                          เก่า 5 ปี
                        </span>
                      )}
                    </div>
                    <p className="text-forest dark:text-slate-100 truncate max-w-xs">
                      {book.title}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      ปีพิมพ์: {book.publication_year ?? "-"}
                    </p>
                  </td>
                  {/* ผู้แต่ง */}
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {book.author ?? "-"}
                  </td>
                  {/* หมวดหมู่ — badge สีตาม category_color */}
                  <td className="px-4 py-3">
                    {book.category_name ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                        style={{
                          backgroundColor: book.category_color ?? "#60a5fa",
                        }}
                      >
                        {book.category_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  {/* เล่มรวม/พร้อมยืม */}
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-forest dark:text-slate-100">
                      {book.available_copies}
                    </span>
                    <span className="text-slate-400">/{book.total_copies}</span>
                  </td>
                  {/* สถานะ */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[statusKey] ?? STATUS_BADGE.active}`}
                    >
                      {STATUS_LABEL[statusKey] ?? statusKey}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-border-base">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            หน้า {page + 1} / {totalPages} • {books.length} รายการ
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="หน้าก่อนหน้า"
            >
              <PhosphorIcon name="caret-left" weight="bold" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, idx) => {
                // แสดงแค่หน้าใกล้ๆ ปัจจุบัน (max 5 หน้า) + หน้าแรก/ท้าย
                if (
                  idx === 0 ||
                  idx === totalPages - 1 ||
                  (idx >= page - 1 && idx <= page + 1)
                ) {
                  return (
                    <button
                      key={idx}
                      onClick={() => setPage(idx)}
                      className={`min-w-[28px] h-7 px-1.5 text-xs font-medium rounded-md transition ${
                        idx === page
                          ? "bg-meb-green text-white"
                          : "text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                }
                if (idx === page - 2 || idx === page + 2) {
                  return (
                    <span key={idx} className="text-xs text-slate-400 px-1">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="หน้าถัดไป"
            >
              <PhosphorIcon name="caret-right" weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}