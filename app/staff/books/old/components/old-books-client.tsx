"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../../components/phosphor-icon";
import { getOldBooksAction, type OldBook } from "../actions";
import { markBookOldAction, reactivateBookAction } from "../../actions";

type OldBooksClientProps = {
  initialBooks: OldBook[];
  error: string | null;
};

/**
 * OldBooksClient — หน้าจัดการหนังสือเก่า 5 ปี
 * - สรุปจำนวน: รอการย้าย (ครบเกณฑ์ยัง active) / หนังสือเก่าแล้ว
 * - ตารางหนังสือครบเกณฑ์ทั้งหมด พร้อมปุ่ม action ต่อแถว
 * - ถ้าเล่มยังถูกยืมอยู่ → ปุ่ม disabled + แจ้งว่าต้องรอคืนก่อน
 */
export function OldBooksClient({ initialBooks, error: initialError }: OldBooksClientProps) {
  const [books, setBooks] = useState(initialBooks);
  const [error, setError] = useState<string | null>(initialError);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pendingCount = books.filter((b) => b.is_old_eligible && !b.is_marked_old).length;
  const markedCount = books.filter((b) => b.is_marked_old).length;

  function refresh() {
    startTransition(async () => {
      const res = await getOldBooksAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setBooks(res.data ?? []);
    });
  }

  async function handleMarkOld(book: OldBook) {
    setPendingId(book.id);
    setActionMsg(null);
    const formData = new FormData();
    formData.set("book_id", book.id);
    const res = await markBookOldAction(formData);
    setPendingId(null);
    if (res.error) {
      setActionMsg({ type: "error", text: res.error });
      return;
    }
    setActionMsg({ type: "success", text: `ย้าย "${book.title}" เป็นหนังสือเก่าเรียบร้อยแล้ว` });
    refresh();
  }

  async function handleReactivate(book: OldBook) {
    setPendingId(book.id);
    setActionMsg(null);
    const formData = new FormData();
    formData.set("book_id", book.id);
    const res = await reactivateBookAction(formData);
    setPendingId(null);
    if (res.error) {
      setActionMsg({ type: "error", text: res.error });
      return;
    }
    setActionMsg({ type: "success", text: `นำ "${book.title}" กลับมาใช้งานแล้ว` });
    refresh();
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
          <PhosphorIcon name="hourglass-high" weight="fill" className="text-2xl text-terracotta" />
          <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
            หนังสือเก่า 5 ปี
          </h1>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          นับอายุจากปีที่พิมพ์ (publication_year) ถึงปัจจุบัน หากครบ 5 ปี หนังสือจะถูกจัดเป็น "หนังสือเก่า"
          — แอดมินเป็นผู้กดย้ายเอง หนังสือเก่าจะซ่อนจากสมาชิกและไม่ให้ยืม แต่ประวัติยืม-คืนยังคงอยู่ครบ
        </p>

        {/* สรุป */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <MiniStat label="ครบเกณฑ์ทั้งหมด" value={books.length} icon="books" color="text-slate-600" />
          <MiniStat label="รอการย้าย (ยังใช้งาน)" value={pendingCount} icon="hourglass-high" color="text-terracotta" />
          <MiniStat label="หนังสือเก่าแล้ว" value={markedCount} icon="archive" color="text-slate-500" />
        </div>

        {/* แจ้งเตือนผลการ action */}
        {actionMsg && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg text-sm mb-4 ${
              actionMsg.type === "success"
                ? "bg-meb-light text-meb-green"
                : "bg-red-50 dark:bg-red-500/10 text-price-red"
            }`}
          >
            <PhosphorIcon name={actionMsg.type === "success" ? "check-circle" : "warning"} weight="fill" />
            {actionMsg.text}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-price-red mb-4">
            <PhosphorIcon name="warning" weight="fill" />
            {error}
          </div>
        )}
      </section>

      {/* ตารางหนังสือเก่า */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
        {pending && !pendingId ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="circle-notch" className="text-3xl animate-spin mr-2" />
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        ) : books.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="hourglass-high" className="text-4xl mx-auto mb-2 opacity-40" />
            <p className="text-sm">ไม่พบหนังสือที่อายุครบ 5 ปี</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">รหัส / ชื่อ</th>
                  <th className="px-5 py-3 font-medium">ปีที่พิมพ์</th>
                  <th className="px-5 py-3 font-medium">หมวดหมู่</th>
                  <th className="px-5 py-3 font-medium text-center">เล่มรวม</th>
                  <th className="px-5 py-3 font-medium text-center">ยืมอยู่</th>
                  <th className="px-5 py-3 font-medium">สถานะ</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => {
                  const borrowed = book.borrowed_count > 0;
                  const disabled = book.is_marked_old || borrowed;
                  return (
                    <tr
                      key={book.id}
                      className="border-b border-gray-50 dark:border-border-base last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-3 min-w-[220px]">
                        <p className="font-bold text-meb-green dark:text-meb-green">{book.book_code}</p>
                        <p className="text-forest dark:text-slate-100 truncate max-w-xs">{book.title}</p>
                        {book.author && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{book.author}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {book.publication_year ?? "-"}
                      </td>
                      <td className="px-5 py-3">
                        {book.category_name ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: book.category_color ?? "#60a5fa" }}
                          >
                            {book.category_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center text-forest dark:text-slate-100 font-semibold">
                        {book.total_copies}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {borrowed ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                            <PhosphorIcon name="hand-arrow-left" weight="fill" className="text-sm" />
                            {book.borrowed_count}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {book.is_marked_old ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-slate-600 dark:text-slate-300">
                            <PhosphorIcon name="archive" weight="fill" className="text-xs" />
                            หนังสือเก่า
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                            <PhosphorIcon name="hourglass-high" weight="fill" className="text-xs" />
                            รอการย้าย
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-right">
                        {book.is_marked_old ? (
                          <button
                            onClick={() => handleReactivate(book)}
                            disabled={pendingId === book.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-meb-green bg-meb-light hover:bg-meb-green hover:text-white rounded-md transition disabled:opacity-60"
                          >
                            {pendingId === book.id ? (
                              <PhosphorIcon name="circle-notch" className="animate-spin text-sm" />
                            ) : (
                              <PhosphorIcon name="arrow-counter-clockwise" weight="bold" className="text-sm" />
                            )}
                            นำกลับมาใช้งาน
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkOld(book)}
                            disabled={disabled || pendingId === book.id}
                            title={borrowed ? `ต้องรอให้คืนครบก่อน (ยืมอยู่ ${book.borrowed_count} เล่ม)` : undefined}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed ${
                              borrowed
                                ? "bg-gray-100 dark:bg-white/10 text-slate-400 dark:text-slate-500"
                                : "bg-terracotta hover:bg-terracotta/90 text-white"
                            }`}
                          >
                            {pendingId === book.id ? (
                              <PhosphorIcon name="circle-notch" className="animate-spin text-sm" />
                            ) : (
                              <PhosphorIcon name="archive" weight="bold" className="text-sm" />
                            )}
                            {borrowed ? "รอคืนก่อน" : "ย้ายเป็นหนังสือเก่า"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
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
