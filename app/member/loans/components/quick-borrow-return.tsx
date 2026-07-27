"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  memberBorrowAction,
  memberReturnAction,
  type MemberBorrowRecord,
} from "../actions";

type QuickBorrowReturnProps = {
  userId: string;
  activeBorrows: MemberBorrowRecord[];
  onBorrowed: () => void;
  onReturned: () => void;
};

/**
 * QuickBorrowReturn — อินเทอร์เฟซยืม/คืนด่วนแบบ self-service
 * ออกแบบเหมือน kiosk: อินพุตใหญ่, กด Enter เพื่อส่ง, แสดงผลทันที
 * มี 2 แผงเรียงข้างกัน (เลื่อนเป็นคอลัมน์บนมือถือ)
 */

// ฟอร์แมตวันที่ dd/MM/yyyy
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function QuickBorrowReturn({
  userId: _userId,
  activeBorrows,
  onBorrowed,
  onReturned,
}: QuickBorrowReturnProps) {
  // --- ยืมหนังสือ ---
  const [borrowBarcode, setBorrowBarcode] = useState("");
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [borrowToast, setBorrowToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const borrowInputRef = useRef<HTMLInputElement>(null);

  // --- คืนหนังสือ ---
  const [returnBarcode, setReturnBarcode] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnToast, setReturnToast] = useState<{
    type: "success" | "error";
    message: string;
    fineAmount?: number;
  } | null>(null);
  const returnInputRef = useRef<HTMLInputElement>(null);

  const [, startTransition] = useTransition();

  // โฟกัสช่องยืมเมื่อ mount
  useEffect(() => {
    if (borrowInputRef.current) {
      borrowInputRef.current.focus();
    }
  }, []);

  // เคลียร์ toast อัตโนมัติ
  useEffect(() => {
    if (borrowToast) {
      const t = setTimeout(() => setBorrowToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [borrowToast]);

  useEffect(() => {
    if (returnToast) {
      const t = setTimeout(() => setReturnToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [returnToast]);

  // --- จัดการยืม ---
  async function handleBorrow(e: React.FormEvent) {
    e.preventDefault();
    const b = borrowBarcode.trim();
    if (!b || borrowLoading) return;

    setBorrowLoading(true);
    setBorrowToast(null);

    try {
      const formData = new FormData();
      formData.set("barcode", b);
      const res = await memberBorrowAction(formData);
      if (res.error) {
        setBorrowToast({ type: "error", message: res.error });
      } else {
        setBorrowToast({
          type: "success",
          message: `ยืมสำเร็จ: ${res.bookTitle ?? "หนังสือ"}`,
        });
        setBorrowBarcode("");
        startTransition(() => {
          onBorrowed();
        });
      }
    } catch {
      setBorrowToast({ type: "error", message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setBorrowLoading(false);
    }
  }

  // --- จัดการคืน (สแกนบาร์โค้ด) ---
  async function handleReturn(e: React.FormEvent) {
    e.preventDefault();
    const b = returnBarcode.trim();
    if (!b || returnLoading) return;

    setReturnLoading(true);
    setReturnToast(null);

    try {
      const formData = new FormData();
      formData.set("barcode", b);
      const res = await memberReturnAction(formData);
      if (res.error) {
        setReturnToast({ type: "error", message: res.error });
      } else {
        setReturnToast({
          type: "success",
          message: `คืนสำเร็จ: ${res.bookTitle ?? "หนังสือ"}`,
          fineAmount: res.fineAmount,
        });
        setReturnBarcode("");
        startTransition(() => {
          onReturned();
        });
      }
    } catch {
      setReturnToast({ type: "error", message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setReturnLoading(false);
    }
  }

  // --- คืนผ่านปุ่มในรายการ ---
  async function handleReturnByRecord(record: MemberBorrowRecord) {
    if (returnLoading) return;
    setReturnLoading(true);
    setReturnToast(null);

    try {
      const formData = new FormData();
      formData.set("record_id", record.id);
      const res = await memberReturnAction(formData);
      if (res.error) {
        setReturnToast({ type: "error", message: res.error });
      } else {
        setReturnToast({
          type: "success",
          message: `คืนสำเร็จ: ${res.bookTitle ?? record.book_copy?.book?.title ?? "หนังสือ"}`,
          fineAmount: res.fineAmount,
        });
        startTransition(() => {
          onReturned();
        });
      }
    } catch {
      setReturnToast({ type: "error", message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setReturnLoading(false);
    }
  }

  // ตรวจ overdue สำหรับรายการ active
  function isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ====== LEFT PANEL: ยืมหนังสือ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อ */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-lg bg-meb-light dark:bg-meb-green/15 flex items-center justify-center text-meb-green text-xl shrink-0">
            <PhosphorIcon name="arrow-counter-clockwise" weight="fill" />
          </div>
          <div>
            <h2 className="text-base font-bold text-forest dark:text-slate-100">
              ยืมหนังสือ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              สแกนบาร์โค้ดเพื่อยืมทันที
            </p>
          </div>
        </div>

        {/* ช่องสแกนบาร์โค้ด — ใหญ่, กด Enter ยืมได้เลย */}
        <form onSubmit={handleBorrow} className="space-y-3">
          <div className="relative">
            <PhosphorIcon
              name="barcode"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-2xl pointer-events-none"
            />
            <input
              ref={borrowInputRef}
              type="text"
              value={borrowBarcode}
              onChange={(e) => setBorrowBarcode(e.target.value)}
              placeholder="สแกนบาร์โค้ดหนังสือ..."
              disabled={borrowLoading}
              className="w-full pl-14 pr-4 py-4 text-base bg-gray-50 dark:bg-black/30 border-2 border-gray-200 dark:border-border-base rounded-xl outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 font-mono placeholder:text-slate-400 disabled:opacity-60"
            />
          </div>

          {/* ปุ่มยืม */}
          <button
            type="submit"
            disabled={borrowLoading || !borrowBarcode.trim()}
            className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-3.5 rounded-xl text-base shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {borrowLoading ? (
              <>
                <PhosphorIcon name="circle-notch" className="animate-spin text-lg" />
                กำลังยืม...
              </>
            ) : (
              <>
                <PhosphorIcon name="arrow-counter-clockwise" weight="bold" className="text-lg" />
                ยืมหนังสือ
              </>
            )}
          </button>
        </form>

        {/* Toast ผลลัพธ์ยืม */}
        {borrowToast && (
          <div
            className={`mt-3 flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
              borrowToast.type === "success"
                ? "bg-meb-light/50 dark:bg-meb-green/10 text-meb-green"
                : "bg-red-50 dark:bg-red-500/10 text-price-red"
            }`}
          >
            <PhosphorIcon
              name={borrowToast.type === "success" ? "check-circle" : "warning-circle"}
              weight="fill"
              className="text-lg shrink-0"
            />
            <span>{borrowToast.message}</span>
          </div>
        )}

        {/* ข้อมูลเพิ่มเติม */}
        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-border-base/40 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <PhosphorIcon name="books" className="text-meb-green" />
            กำลังยืม {activeBorrows.length} เล่ม
          </div>
          <div className="flex items-center gap-1.5">
            <PhosphorIcon name="calendar-blank" className="text-meb-green" />
            ระยะเวลายืม 14 วัน
          </div>
          <div className="flex items-center gap-1.5">
            <PhosphorIcon name="info" className="text-meb-green" />
            สแกนบาร์โค้ดแล้วกด Enter เพื่อยืมทันที
          </div>
        </div>
      </section>

      {/* ====== RIGHT PANEL: คืนหนังสือ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อ */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xl shrink-0">
            <PhosphorIcon name="arrow-u-up-left" weight="fill" />
          </div>
          <div>
            <h2 className="text-base font-bold text-forest dark:text-slate-100">
              คืนหนังสือ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              สแกนบาร์โค้ดเพื่อคืน หรือกดปุ่มคืนในรายการ
            </p>
          </div>
        </div>

        {/* ช่องสแกนบาร์โค้ด — ใหญ่, กด Enter คืนได้เลย */}
        <form onSubmit={handleReturn} className="space-y-3">
          <div className="relative">
            <PhosphorIcon
              name="barcode"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-2xl pointer-events-none"
            />
            <input
              ref={returnInputRef}
              type="text"
              value={returnBarcode}
              onChange={(e) => setReturnBarcode(e.target.value)}
              placeholder="สแกนบาร์โค้ดเพื่อคืน..."
              disabled={returnLoading}
              className="w-full pl-14 pr-4 py-4 text-base bg-gray-50 dark:bg-black/30 border-2 border-gray-200 dark:border-border-base rounded-xl outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 font-mono placeholder:text-slate-400 disabled:opacity-60"
            />
          </div>

          {/* ปุ่มคืน */}
          <button
            type="submit"
            disabled={returnLoading || !returnBarcode.trim()}
            className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3.5 rounded-xl text-base shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {returnLoading ? (
              <>
                <PhosphorIcon name="circle-notch" className="animate-spin text-lg" />
                กำลังคืน...
              </>
            ) : (
              <>
                <PhosphorIcon name="arrow-u-up-left" weight="bold" className="text-lg" />
                คืนหนังสือ
              </>
            )}
          </button>
        </form>

        {/* Toast ผลลัพธ์คืน */}
        {returnToast && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm font-medium space-y-1 ${
              returnToast.type === "success"
                ? "bg-meb-light/50 dark:bg-meb-green/10 text-meb-green"
                : "bg-red-50 dark:bg-red-500/10 text-price-red"
            }`}
          >
            <div className="flex items-center gap-2">
              <PhosphorIcon
                name={returnToast.type === "success" ? "check-circle" : "warning-circle"}
                weight="fill"
                className="text-lg shrink-0"
              />
              <span>{returnToast.message}</span>
            </div>
            {returnToast.type === "success" && returnToast.fineAmount && returnToast.fineAmount > 0 && (
              <div className="flex items-center gap-2 pl-7 text-price-red font-bold">
                <PhosphorIcon name="currency-dollar" weight="fill" className="text-sm" />
                ค่าปรับกรณีคืนช้า: ฿{returnToast.fineAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        )}

        {/* รายการยืมปัจจุบัน — กดปุ่มคืนได้ */}
        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-border-base/40">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <PhosphorIcon name="list" className="text-sm" />
            หนังสือที่กำลังยืม ({activeBorrows.length})
          </h3>

          {activeBorrows.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center">
              ไม่มีหนังสือที่กำลังยืม
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {activeBorrows.map((record) => {
                const overdue = isOverdue(record.due_date);
                const title = record.book_copy?.book?.title ?? "ไม่ระบุชื่อ";
                return (
                  <li
                    key={record.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-border-base hover:bg-gray-50 dark:hover:bg-white/5 transition"
                  >
                    {record.book_copy?.book?.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={record.book_copy.book.cover_image_url}
                        alt={title}
                        className="w-7 h-10 object-cover rounded bg-gray-100 dark:bg-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-10 rounded bg-meb-light flex items-center justify-center text-meb-green shrink-0">
                        <PhosphorIcon name="book" className="text-xs" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-forest dark:text-slate-100 truncate">
                        {title}
                      </p>
                      <p className={`text-[10px] ${overdue ? "text-price-red font-bold" : "text-slate-500 dark:text-slate-400"}`}>
                        ครบกำหนด {formatDate(record.due_date)}
                        {overdue && " (เกินกำหนด)"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleReturnByRecord(record)}
                      disabled={returnLoading}
                      className="shrink-0 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-md transition disabled:opacity-60"
                    >
                      คืน
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}