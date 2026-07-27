"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { Modal } from "../../../components/modal";
import {
  memberExtendAction,
  memberReturnAction,
  type MemberBorrowRecord,
} from "../actions";
import { rateBookAction } from "../../favorites/actions";

type MyBorrowsProps = {
  active: MemberBorrowRecord[];
  history: MemberBorrowRecord[];
  onRefresh: () => void;
};

/**
 * MyBorrows — แสดงรายการยืมของสมาชิก
 * Section 1: กำลังยืมอยู่ (พร้อมปุ่มต่ออายุ + คืน)
 * Section 2: ประวัติการยืม (collapsible)
 */

// ฟอร์แมตวันที่ dd/MM/yyyy
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// คำนวณวันที่เหลือ (หรือเกินกำหนดกี่วัน)
function getRemainingDays(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// สถานะ badge
function StatusBadge({ status, dueDate }: { status: string; dueDate: string }) {
  if (status === "overdue" || (status === "borrowing" && getRemainingDays(dueDate) < 0)) {
    return (
      <span className="px-2.5 py-1 bg-red-50 dark:bg-red-950/20 text-price-red font-bold rounded-full border border-red-100 dark:border-red-900/30 flex items-center gap-1 text-xs">
        <PhosphorIcon name="warning-circle" weight="fill" />
        เกินกำหนด
      </span>
    );
  }
  if (status === "borrowing") {
    return (
      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-meb-green font-bold rounded-full border border-emerald-100 dark:border-emerald-900/30 text-xs">
        กำลังยืม
      </span>
    );
  }
  if (status === "returned") {
    return (
      <span className="px-2.5 py-1 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-bold rounded-full border border-slate-200 dark:border-border-base text-xs">
        คืนแล้ว
      </span>
    );
  }
  if (status === "lost") {
    return (
      <span className="px-2.5 py-1 bg-red-50 dark:bg-red-950/20 text-price-red font-bold rounded-full border border-red-100 dark:border-red-900/30 text-xs">
        สูญหาย
      </span>
    );
  }
  return null;
}

export function MyBorrows({ active, history, onRefresh }: MyBorrowsProps) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
    fineAmount?: number;
  } | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  // sub-tab สำหรับสลับกำลังยืม / ประวัติ
  const [subTab, setSubTab] = useState<"active" | "history">(
    active.length > 0 ? "active" : "history",
  );

  // state สำหรับประวัติ — pagination + search + detail
  const [historyPage, setHistoryPage] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [detailRecord, setDetailRecord] = useState<MemberBorrowRecord | null>(null);
  const HISTORY_PER_PAGE = 25;

  // กรองประวัติตามคำค้นหา
  const filteredHistory = history.filter((r) => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    const title = (r.book_copy?.book?.title ?? "").toLowerCase();
    const barcode = (r.book_copy?.barcode ?? "").toLowerCase();
    return title.includes(q) || barcode.includes(q);
  });

  const totalHistoryPages = Math.ceil(filteredHistory.length / HISTORY_PER_PAGE);
  const historyPageData = filteredHistory.slice(
    historyPage * HISTORY_PER_PAGE,
    (historyPage + 1) * HISTORY_PER_PAGE,
  );

  // state สำหรับ modal คืนหนังสือ
  const [returnModal, setReturnModal] = useState<MemberBorrowRecord | null>(null);
  const [condition, setCondition] = useState("good");
  const [fineReason, setFineReason] = useState("");
  const [manualFine, setManualFine] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [returnPending, startReturnTransition] = useTransition();

  // ต่ออายุ
  async function handleExtend(recordId: string) {
    setToast(null);
    const formData = new FormData();
    formData.set("record_id", recordId);
    const res = await memberExtendAction(formData);
    if (res.error) {
      setToast({ type: "error", message: res.error });
    } else {
      setToast({ type: "success", message: "ต่ออายุสำเร็จ (+7 วัน)" });
      startTransition(() => {
        onRefresh();
      });
    }
    // เคลียร์ toast หลัง 3 วินาที
    setTimeout(() => setToast(null), 3000);
  }

  // เปิด modal คืนหนังสือ (ไม่คืนทันที)
  function openReturnModal(record: MemberBorrowRecord) {
    setReturnModal(record);
    setCondition("good");
    setFineReason("");
    setManualFine("");
    setRating(0);
    setHoverRating(0);
  }

  // ยืนยันคืนหนังสือจาก modal
  async function confirmReturn() {
    if (!returnModal) return;
    setToast(null);

    startReturnTransition(async () => {
      const formData = new FormData();
      formData.set("record_id", returnModal.id);
      formData.set("condition", condition);
      if (fineReason) formData.set("fine_reason", fineReason);
      if (manualFine) formData.set("fine_amount", manualFine);

      const res = await memberReturnAction(formData);

      // ให้คะแนนหนังสือถ้ามี
      if (rating > 0 && !res.error) {
        const bookId = (returnModal as any).book_copy?.book?.id;
        if (bookId) {
          const rateForm = new FormData();
          rateForm.set("bookId", bookId);
          rateForm.set("rating", String(rating));
          await rateBookAction(rateForm);
        }
      }

      if (res.error) {
        setToast({ type: "error", message: res.error });
      } else {
        setToast({
          type: "success",
          message: `คืนสำเร็จ: ${res.bookTitle ?? returnModal.book_copy?.book?.title ?? "หนังสือ"}`,
          fineAmount: res.fineAmount,
        });
        setReturnModal(null);
        startTransition(() => {
          onRefresh();
        });
      }
      setTimeout(() => setToast(null), 5000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Toast ผลลัพธ์ */}
      {toast && (
        <div
          className={`p-3.5 rounded-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-meb-light/50 dark:bg-meb-green/10 text-meb-green"
              : "bg-red-50 dark:bg-red-500/10 text-price-red"
          }`}
        >
          <div className="flex items-center gap-2">
            <PhosphorIcon
              name={toast.type === "success" ? "check-circle" : "warning-circle"}
              weight="fill"
              className="text-lg shrink-0"
            />
            <span>{toast.message}</span>
          </div>
          {toast.type === "success" && toast.fineAmount && toast.fineAmount > 0 && (
            <div className="flex items-center gap-2 pl-7 mt-1 text-price-red font-bold">
              <PhosphorIcon name="currency-dollar" weight="fill" className="text-sm" />
              ค่าปรับกรณีคืนช้า: ฿{toast.fineAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>
      )}

      {/* ====== Sub-tabs: กำลังยืม / ประวัติ ====== */}
      <nav
        className="flex border-b border-gray-100 dark:border-border-base"
        aria-label="ประเภทการยืม"
      >
        <button
          onClick={() => setSubTab("active")}
          className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 ${
            subTab === "active"
              ? "border-meb-green text-meb-green"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-forest dark:hover:text-slate-200"
          }`}
        >
          <PhosphorIcon name="book-open" weight={subTab === "active" ? "fill" : "regular"} className="text-base" />
          กำลังยืมอยู่
          {active.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-meb-light dark:bg-meb-green/10 text-meb-green rounded-full leading-none">
              {active.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 ${
            subTab === "history"
              ? "border-meb-green text-meb-green"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-forest dark:hover:text-slate-200"
          }`}
        >
          <PhosphorIcon name="clock-countdown" weight={subTab === "history" ? "fill" : "regular"} className="text-base" />
          ประวัติการยืม
          {history.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-full leading-none">
              {history.length}
            </span>
          )}
        </button>
      </nav>

      {/* ====== เนื้อหา sub-tab ====== */}
      {subTab === "active" && (
        <section>
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base text-slate-400 dark:text-slate-500 transition-colors">
              <PhosphorIcon name="books" className="text-4xl mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">คุณไม่มีหนังสือที่กำลังยืมอยู่</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {active.map((record) => {
                const title = record.book_copy?.book?.title ?? "ไม่ระบุชื่อ";
                const author = record.book_copy?.book?.author ?? "ไม่ระบุผู้แต่ง";
                const barcode = record.book_copy?.barcode ?? "-";
                const remaining = getRemainingDays(record.due_date);
                const overdue = remaining < 0;
                const canExtend = record.extension_count < 1;

                return (
                  <div
                    key={record.id}
                    className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-4 flex gap-3 transition hover:shadow-sm"
                  >
                    {/* ปกหนังสือ */}
                    <div className="w-10 h-14 rounded overflow-hidden border border-gray-200 dark:border-border-base shrink-0 bg-gray-50 dark:bg-black/20 flex items-center justify-center">
                      {record.book_copy?.book?.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={record.book_copy.book.cover_image_url}
                          alt={title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <PhosphorIcon name="book" className="text-slate-300 dark:text-slate-600 text-lg" />
                      )}
                    </div>

                    {/* รายละเอียด */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                            {title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {author}
                          </p>
                        </div>
                        <StatusBadge status={record.status} dueDate={record.due_date} />
                      </div>

                      <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <p className="font-mono">{barcode}</p>
                        <div className="flex flex-wrap gap-x-3">
                          <span>ยืม: {formatDate(record.borrowed_at)}</span>
                          <span className={overdue ? "text-price-red font-bold" : ""}>
                            ครบกำหนด: {formatDate(record.due_date)}
                            {overdue && ` (เกิน ${Math.abs(remaining)} วัน)`}
                          </span>
                        </div>
                        {canExtend && (
                          <p className="text-meb-green flex items-center gap-1">
                            <PhosphorIcon name="info" className="text-[10px]" />
                            ต่ออายุได้อีก 1 ครั้ง
                          </p>
                        )}
                      </div>

                      {/* ปุ่ม action */}
                      <div className="mt-2.5 flex gap-2">
                        {canExtend ? (
                          <button
                            type="button"
                            onClick={() => handleExtend(record.id)}
                            disabled={pending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-meb-green bg-meb-light dark:bg-meb-green/10 hover:bg-meb-light/80 dark:hover:bg-meb-green/20 rounded-md transition disabled:opacity-60"
                          >
                            <PhosphorIcon name="calendar-plus" className="text-sm" />
                            ต่ออายุ
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500">
                            <PhosphorIcon name="prohibit" className="text-sm" />
                            ต่ออายุครบแล้ว
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openReturnModal(record)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-md transition disabled:opacity-60"
                        >
                          <PhosphorIcon name="arrow-u-up-left" className="text-sm" />
                          คืนหนังสือ
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {subTab === "history" && (
        <section>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base text-slate-400 dark:text-slate-500 transition-colors">
              <PhosphorIcon name="archive" className="text-4xl mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">คุณยังไม่มีประวัติการยืมหนังสือ</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
              {/* ช่องค้นหา */}
              <div className="p-3 border-b border-gray-100 dark:border-border-base">
                <div className="relative">
                  <PhosphorIcon
                    name="magnifying-glass"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                  />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(0);
                    }}
                    placeholder="ค้นหาชื่อหนังสือหรือบาร์โค้ด..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
                  />
                </div>
              </div>

              {/* ตาราง */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-black/20 text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">หนังสือ</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">บาร์โค้ด</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">วันที่ยืม</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">วันที่คืน</th>
                      <th className="text-right px-4 py-2.5 font-medium">ค่าปรับ</th>
                      <th className="text-center px-4 py-2.5 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-border-base/40">
                    {historyPageData.map((record) => {
                      const title = record.book_copy?.book?.title ?? "ไม่ระบุชื่อ";
                      const barcode = record.book_copy?.barcode ?? "-";
                      return (
                        <tr
                          key={record.id}
                          onClick={() => setDetailRecord(record)}
                          className="hover:bg-gray-50 dark:hover:bg-white/5 transition cursor-pointer"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-9 rounded overflow-hidden border border-gray-200 dark:border-border-base shrink-0 bg-gray-50 dark:bg-black/20 flex items-center justify-center">
                                {record.book_copy?.book?.cover_image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={record.book_copy.book.cover_image_url}
                                    alt={title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <PhosphorIcon name="book" className="text-[10px] text-slate-300 dark:text-slate-600" />
                                )}
                              </div>
                              <span className="font-medium text-forest dark:text-slate-100 truncate max-w-[160px]">
                                {title}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                            {barcode}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
                            {formatDate(record.borrowed_at)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
                            {record.returned_at ? formatDate(record.returned_at) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {record.fine_amount > 0 ? (
                              <span className="font-bold text-price-red text-xs">
                                ฿{record.fine_amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <PhosphorIcon name="caret-right" className="text-slate-300 text-sm" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ไม่พบผลค้นหา */}
              {historyPageData.length === 0 && historySearch && (
                <div className="py-8 text-center">
                  <PhosphorIcon name="magnifying-glass" className="text-2xl text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">ไม่พบหนังสือที่ตรงกับ "{historySearch}"</p>
                </div>
              )}

              {/* Pagination */}
              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-border-base">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    หน้า {historyPage + 1} / {totalHistoryPages} • {filteredHistory.length} รายการ
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                      disabled={historyPage === 0}
                      className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      aria-label="หน้าก่อนหน้า"
                    >
                      <PhosphorIcon name="caret-left" weight="bold" />
                    </button>
                    {/* หมายเลขหน้า */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalHistoryPages }).map((_, idx) => {
                        // แสดงแค่หน้าใกล้ๆ ปัจจุบัน (max 5 หน้า)
                        if (
                          idx === 0 ||
                          idx === totalHistoryPages - 1 ||
                          (idx >= historyPage - 1 && idx <= historyPage + 1)
                        ) {
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setHistoryPage(idx)}
                              className={`min-w-[28px] h-7 px-1.5 text-xs font-medium rounded-md transition ${
                                idx === historyPage
                                  ? "bg-meb-green text-white"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
                              }`}
                            >
                              {idx + 1}
                            </button>
                          );
                        }
                        // แสดง ... สำหรับหน้าที่ข้าม
                        if (idx === historyPage - 2 || idx === historyPage + 2) {
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
                      type="button"
                      onClick={() => setHistoryPage(Math.min(totalHistoryPages - 1, historyPage + 1))}
                      disabled={historyPage === totalHistoryPages - 1}
                      className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      aria-label="หน้าถัดไป"
                    >
                      <PhosphorIcon name="caret-right" weight="bold" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ====== Modal คืนหนังสือ ====== */}
      <Modal
        open={returnModal !== null}
        onClose={() => setReturnModal(null)}
        title="คืนหนังสือ"
        description={
          returnModal?.book_copy?.book?.title ?? "หนังสือ"
        }
        size="md"
      >
        {returnModal && (
          <div className="space-y-5">
            {/* ข้อมูลหนังสือ */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-black/20 rounded-lg p-3">
              <div className="w-10 h-14 rounded overflow-hidden border border-gray-200 dark:border-border-base shrink-0 bg-gray-100">
                {returnModal.book_copy?.book?.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={returnModal.book_copy.book.cover_image_url}
                    alt={returnModal.book_copy.book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PhosphorIcon name="book" className="text-slate-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {returnModal.book_copy?.book?.title ?? "ไม่ระบุชื่อ"}
                </p>
                <p className="text-xs font-mono text-meb-green">
                  {returnModal.book_copy?.barcode}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  กำหนดคืน: {formatDate(returnModal.due_date)}
                  {getRemainingDays(returnModal.due_date) < 0 && (
                    <span className="text-price-red font-bold ml-1">
                      (เกิน {Math.abs(getRemainingDays(returnModal.due_date))} วัน)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* สภาพหนังสือ */}
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-2">
                สภาพหนังสือ
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: "new", label: "มือหนึ่ง", color: "meb-green" },
                  { value: "good", label: "สภาพดี", color: "blue-600" },
                  { value: "fair", label: "พอใช้", color: "amber-600" },
                  { value: "poor", label: "ชำรุด", color: "price-red" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCondition(opt.value)}
                    className={`px-3 py-2 text-xs font-bold rounded-md border-2 transition ${
                      condition === opt.value
                        ? "border-meb-green bg-meb-light/50 text-meb-green"
                        : "border-gray-200 dark:border-border-base text-slate-600 dark:text-slate-400 hover:border-meb-green/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {condition === "poor" && (
                <p className="text-xs text-price-red mt-2 flex items-center gap-1">
                  <PhosphorIcon name="warning-circle" weight="fill" className="text-sm" />
                  หนังสือชำรุด — อาจมีค่าปรับ
                </p>
              )}
            </div>

            {/* เหตุผลค่าปรับ + ค่าปรับ manual */}
            {(condition === "poor" || getRemainingDays(returnModal.due_date) < 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    เหตุผลค่าปรับ
                  </label>
                  <select
                    value={fineReason}
                    onChange={(e) => setFineReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
                  >
                    <option value="">— อัตโนมัติ —</option>
                    <option value="overdue">คืนช้า</option>
                    <option value="damaged">ชำรุด</option>
                    <option value="lost">สูญหาย</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                    ค่าปรับ (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualFine}
                    onChange={(e) => setManualFine(e.target.value)}
                    placeholder="อัตโนมัติ"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            {/* ให้คะแนนหนังสือ */}
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-2">
                ให้คะแนนหนังสือเล่มนี้
              </label>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const starValue = i + 1;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(starValue)}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-2xl transition"
                    >
                      <PhosphorIcon
                        name="star"
                        weight={(hoverRating || rating) >= starValue ? "fill" : "regular"}
                        className={
                          (hoverRating || rating) >= starValue
                            ? "text-yellow-400"
                            : "text-slate-300 dark:text-slate-600"
                        }
                      />
                    </button>
                  );
                })}
                {rating > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                    คุณให้ {rating} ดาว
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                ขอบคุณที่ให้คะแนน — จะช่วยให้สมาชิกคนอื่นรู้จักหนังสือเล่มนี้
              </p>
            </div>

            {/* ปุ่มยืนยัน */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={confirmReturn}
                disabled={returnPending}
                className="btn-cta flex-1 inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-3 rounded-md text-sm shadow-sm disabled:opacity-60"
              >
                {returnPending ? (
                  <>
                    <PhosphorIcon name="circle-notch" className="animate-spin" />
                    กำลังคืน...
                  </>
                ) : (
                  <>
                    <PhosphorIcon name="check-circle" weight="fill" />
                    ยืนยันการคืน
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setReturnModal(null)}
                className="px-5 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ====== Modal รายละเอียดการยืม ====== */}
      <Modal
        open={detailRecord !== null}
        onClose={() => setDetailRecord(null)}
        title="รายละเอียดการยืม"
        size="md"
      >
        {detailRecord && (
          <div className="space-y-4">
            {/* ข้อมูลหนังสือ */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-black/20 rounded-lg p-3">
              <div className="w-12 h-16 rounded overflow-hidden border border-gray-200 dark:border-border-base shrink-0 bg-gray-100">
                {detailRecord.book_copy?.book?.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detailRecord.book_copy.book.cover_image_url}
                    alt={detailRecord.book_copy.book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PhosphorIcon name="book" className="text-slate-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {detailRecord.book_copy?.book?.title ?? "ไม่ระบุชื่อ"}
                </p>
                <p className="text-xs font-mono text-meb-green mt-0.5">
                  {detailRecord.book_copy?.barcode}
                </p>
              </div>
            </div>

            {/* รายละเอียด */}
            <dl className="space-y-2 text-sm">
              <DetailRow label="วันที่ยืม" value={formatDate(detailRecord.borrowed_at)} />
              <DetailRow label="กำหนดคืน" value={formatDate(detailRecord.due_date)} />
              <DetailRow
                label="วันที่คืนจริง"
                value={detailRecord.returned_at ? formatDate(detailRecord.returned_at) : "—"}
              />
              <DetailRow
                label="สถานะ"
                value={
                  <StatusBadge status={detailRecord.status} dueDate={detailRecord.due_date} />
                }
              />
              <DetailRow
                label="การต่ออายุ"
                value={
                  detailRecord.extension_count > 0
                    ? `ต่อแล้ว ${detailRecord.extension_count} ครั้ง`
                    : "ไม่ได้ต่ออายุ"
                }
              />
              {detailRecord.fine_amount > 0 && (
                <>
                  <DetailRow
                    label="ค่าปรับ"
                    value={
                      <span className="font-bold text-price-red">
                        ฿{detailRecord.fine_amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    }
                  />
                  <DetailRow
                    label="เหตุผลค่าปรับ"
                    value={
                      detailRecord.fine_reason === "overdue" ? "คืนช้า" :
                      detailRecord.fine_reason === "damaged" ? "ชำรุด" :
                      detailRecord.fine_reason === "lost" ? "สูญหาย" :
                      detailRecord.fine_reason === "other" ? "อื่นๆ" : "—"
                    }
                  />
                </>
              )}
              {detailRecord.remark && (
                <DetailRow label="หมายเหตุ" value={detailRecord.remark} />
              )}
            </dl>

            {/* ปุ่มปิด */}
            <button
              type="button"
              onClick={() => setDetailRecord(null)}
              className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
            >
              ปิด
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** แถวรายละเอียด — label + value */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-50 dark:border-border-base/40">
      <dt className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-700 dark:text-slate-200 text-right min-w-0">{value}</dd>
    </div>
  );
}