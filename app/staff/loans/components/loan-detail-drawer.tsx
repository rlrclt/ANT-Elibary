"use client";

import { useEffect, useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  extendDueDateAction,
  returnBookAction,
  markAsLostAction,
  type BorrowRecord,
} from "../actions";

/**
 * loan-detail-drawer — แผงรายละเอียดรายการยืม
 * Slide-in จากขวา (สไตล์เดียวกับ book-copies-drawer)
 * โชว์ข้อมูลเต็ม + ปุ่มต่ออายุ/คืน/แจ้งสูญหาย
 */
type LoanDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: BorrowRecord | null;
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
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ฟอร์แมตวันที่เวลา dd/MM/yyyy HH:mm
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// ฟอร์แมตเงิน ฿X,XXX
function formatMoney(n: number): string {
  return `฿${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// ดึง 2 ตัวอักษรแรกของชื่อ
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function LoanDetailDrawer({ open, onClose, record }: LoanDetailDrawerProps) {
  const [pending, startTransition] = useTransition();
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ฟอร์มคืน inline
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnFineAmount, setReturnFineAmount] = useState(0);
  const [returnFineReason, setReturnFineReason] = useState<
    "overdue" | "damaged" | "lost" | "other" | ""
  >("");
  const [returnRemark, setReturnRemark] = useState("");

  // ฟอร์มแจ้งสูญหาย inline
  const [showLostConfirm, setShowLostConfirm] = useState(false);
  const [lostFineAmount, setLostFineAmount] = useState(0);

  // ล็อก scroll + ESC เมื่อเปิด drawer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open, onClose]);

  // reset เมื่อ record เปลี่ยน
  useEffect(() => {
    setAlert(null);
    setShowReturnForm(false);
    setShowLostConfirm(false);
    setReturnFineAmount(0);
    setReturnFineReason("");
    setReturnRemark("");
    setLostFineAmount(0);
  }, [record?.id]);

  // ต่ออายุ 7 วัน
  function handleExtend() {
    if (!record) return;
    setAlert(null);
    const formData = new FormData();
    formData.set("record_id", record.id);
    startTransition(async () => {
      const res = await extendDueDateAction(formData);
      if (res.error) {
        setAlert({ type: "error", msg: res.error });
      } else {
        setAlert({
          type: "success",
          msg: `ต่ออายุสำเร็จ กำหนดคืนใหม่: ${res.newDueDate ? formatDate(res.newDueDate) : "-"}`,
        });
      }
    });
  }

  // คืนหนังสือ
  function handleReturn() {
    if (!record) return;
    setAlert(null);
    const formData = new FormData();
    formData.set("record_id", record.id);
    if (returnFineAmount > 0) {
      formData.set("fine_amount", returnFineAmount.toString());
      formData.set("fine_reason", returnFineReason || "overdue");
    }
    if (returnRemark) {
      formData.set("remark", returnRemark);
    }
    startTransition(async () => {
      const res = await returnBookAction(formData);
      if (res.error) {
        setAlert({ type: "error", msg: res.error });
      } else {
        setAlert({ type: "success", msg: "คืนหนังสือสำเร็จ" });
        setShowReturnForm(false);
      }
    });
  }

  // แจ้งสูญหาย
  function handleMarkLost() {
    if (!record) return;
    setAlert(null);
    const formData = new FormData();
    formData.set("record_id", record.id);
    if (lostFineAmount > 0) {
      formData.set("fine_amount", lostFineAmount.toString());
    }
    startTransition(async () => {
      const res = await markAsLostAction(formData);
      if (res.error) {
        setAlert({ type: "error", msg: res.error });
      } else {
        setAlert({ type: "success", msg: "แจ้งสูญหายสำเร็จ" });
        setShowLostConfirm(false);
      }
    });
  }

  const isActive = record?.status === "borrowing" || record?.status === "overdue";
  const canExtend = record?.extension_count === 0 && isActive;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer slide-in จากขวา */}
      <aside
        className={`fixed top-0 right-0 z-[95] h-full w-full max-w-md bg-white dark:bg-card-bg shadow-2xl border-l border-gray-100 dark:border-border-base transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-border-base">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-bold text-forest dark:text-slate-100">
              รายละเอียดการยืม
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              รหัส: <span className="font-mono">{record?.id.slice(0, 8) ?? "-"}...</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 transition"
            aria-label="ปิด"
          >
            <PhosphorIcon name="x" className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto h-[calc(100%-88px)]">
          {!record ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <PhosphorIcon name="book-open" className="text-5xl mb-3" />
              <p className="text-sm">ไม่พบข้อมูลรายการยืม</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Alert */}
              {alert && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    alert.type === "success"
                      ? "bg-meb-light text-meb-green"
                      : "bg-red-50 dark:bg-red-500/10 text-price-red"
                  }`}
                >
                  <PhosphorIcon
                    name={alert.type === "success" ? "check-circle" : "warning"}
                    weight="fill"
                  />
                  {alert.msg}
                </div>
              )}

              {/* สมาชิก */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  สมาชิก
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-meb-light text-meb-green flex items-center justify-center text-sm font-bold shrink-0">
                    {record.user?.full_name ? getInitials(record.user.full_name) : "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-forest dark:text-slate-100 truncate">
                      {record.user?.full_name ?? "-"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {record.user?.user_id_code ?? "-"}
                    </p>
                  </div>
                </div>
              </section>

              {/* หนังสือ */}
              <section>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  หนังสือ
                </h3>
                <div className="flex items-center gap-3">
                  {record.book_copy?.book?.cover_image_url ? (
                    <img
                      src={record.book_copy.book.cover_image_url}
                      alt={record.book_copy.book.title}
                      width={40}
                      height={56}
                      className="w-10 h-14 object-cover rounded bg-gray-100 dark:bg-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded bg-meb-light flex items-center justify-center text-meb-green shrink-0">
                      <PhosphorIcon name="book" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-forest dark:text-slate-100 truncate">
                      {record.book_copy?.book?.title ?? "-"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      รหัส: {record.book_copy?.book?.book_code ?? "-"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      บาร์โค้ด: {record.book_copy?.barcode ?? "-"}
                    </p>
                  </div>
                </div>
              </section>

              {/* วันที่ */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  วันที่
                </h3>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">วันที่ยืม</span>
                  <span className="text-forest dark:text-slate-100 font-medium">
                    {formatDateTime(record.borrowed_at)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">กำหนดคืน</span>
                  <span
                    className={`font-medium ${
                      record.status === "overdue"
                        ? "text-price-red font-bold"
                        : "text-forest dark:text-slate-100"
                    }`}
                  >
                    {formatDateTime(record.due_date)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">วันที่คืนจริง</span>
                  <span className="text-forest dark:text-slate-100 font-medium">
                    {formatDateTime(record.returned_at)}
                  </span>
                </div>
              </section>

              {/* สถานะ + การขยาย */}
              <section className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[record.status] ?? STATUS_BADGE.borrowing}`}
                >
                  {STATUS_LABEL[record.status] ?? record.status}
                </span>
                {record.extension_count >= 1 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                    ต่ออายุแล้ว
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-meb-light text-meb-green">
                    ต่ออายุได้ 1 ครั้ง
                  </span>
                )}
              </section>

              {/* ค่าปรับ */}
              {record.fine_amount > 0 && (
                <section className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10">
                  <h3 className="text-xs font-bold text-price-red uppercase tracking-wider mb-1">
                    ค่าปรับ
                  </h3>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500 dark:text-slate-400">จำนวน</span>
                    <span className="text-price-red font-bold">
                      {formatMoney(Number(record.fine_amount))}
                    </span>
                  </div>
                  {record.fine_reason && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-500 dark:text-slate-400">เหตุผล</span>
                      <span className="text-forest dark:text-slate-100">
                        {record.fine_reason === "overdue"
                          ? "เกินกำหนด"
                          : record.fine_reason === "damaged"
                            ? "ชำรุด"
                            : record.fine_reason === "lost"
                              ? "สูญหาย"
                              : "อื่นๆ"}
                      </span>
                    </div>
                  )}
                  {record.remark && (
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 pt-1 border-t border-red-100 dark:border-red-900/30">
                      หมายเหตุ: {record.remark}
                    </div>
                  )}
                </section>
              )}

              {/* ปุ่มการจัดการ */}
              {isActive && (
                <section className="space-y-2 pt-2 border-t border-gray-100 dark:border-border-base">
                  {/* ต่ออายุ */}
                  {canExtend && !showReturnForm && !showLostConfirm && (
                    <button
                      type="button"
                      onClick={handleExtend}
                      disabled={pending}
                      className="w-full inline-flex items-center justify-center gap-2 bg-meb-light text-meb-green hover:bg-meb-light/70 font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60"
                    >
                      {pending ? (
                        <PhosphorIcon name="circle-notch" className="animate-spin" />
                      ) : (
                        <PhosphorIcon name="calendar-plus" weight="bold" />
                      )}
                      ต่ออายุ 7 วัน
                    </button>
                  )}

                  {/* คืนหนังสือ */}
                  {!showReturnForm && !showLostConfirm && (
                    <button
                      type="button"
                      onClick={() => setShowReturnForm(true)}
                      disabled={pending}
                      className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60"
                    >
                      <PhosphorIcon name="arrow-u-up-left" weight="bold" />
                      คืนหนังสือ
                    </button>
                  )}

                  {/* ฟอร์มคืน inline */}
                  {showReturnForm && (
                    <div className="p-3 rounded-lg border border-gray-100 dark:border-border-base space-y-2">
                      <h4 className="text-sm font-bold text-forest dark:text-slate-100">
                        ฟอร์มคืนหนังสือ
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                            ค่าปรับ (บาท)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={returnFineAmount}
                            onChange={(e) =>
                              setReturnFineAmount(parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded outline-none focus:border-meb-green text-forest dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                            เหตุผล
                          </label>
                          <select
                            value={returnFineReason}
                            onChange={(e) =>
                              setReturnFineReason(
                                e.target.value as "overdue" | "damaged" | "lost" | "other" | "",
                              )
                            }
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded outline-none focus:border-meb-green text-forest dark:text-slate-100"
                          >
                            <option value="">ไม่มี</option>
                            <option value="overdue">เกินกำหนด</option>
                            <option value="damaged">ชำรุด</option>
                            <option value="lost">สูญหาย</option>
                            <option value="other">อื่นๆ</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                            หมายเหตุ
                          </label>
                          <input
                            type="text"
                            value={returnRemark}
                            onChange={(e) => setReturnRemark(e.target.value)}
                            placeholder="หมายเหตุ..."
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded outline-none focus:border-meb-green text-forest dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleReturn}
                          disabled={pending}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2 rounded-md text-sm transition disabled:opacity-60"
                        >
                          {pending ? (
                            <PhosphorIcon name="circle-notch" className="animate-spin" />
                          ) : (
                            <PhosphorIcon name="check" weight="bold" />
                          )}
                          ยืนยันการคืน
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReturnForm(false)}
                          disabled={pending}
                          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}

                  {/* แจ้งสูญหาย */}
                  {!showReturnForm && !showLostConfirm && (
                    <button
                      type="button"
                      onClick={() => setShowLostConfirm(true)}
                      disabled={pending}
                      className="w-full inline-flex items-center justify-center gap-2 bg-red-50 dark:bg-red-500/10 text-price-red hover:bg-red-100 dark:hover:bg-red-500/20 font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60"
                    >
                      <PhosphorIcon name="warning-octagon" weight="bold" />
                      แจ้งสูญหาย
                    </button>
                  )}

                  {/* ยืนยันสูญหาย */}
                  {showLostConfirm && (
                    <div className="p-3 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-500/10 space-y-2">
                      <h4 className="text-sm font-bold text-price-red">
                        ยืนยันการแจ้งสูญหาย
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        หนังสือจะถูกทำเครื่องหมายว่าสูญหายและไม่สามารถยกเลิกได้
                      </p>
                      <div>
                        <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                          ค่าปรับสูญหาย (บาท) — ไม่บังคับ
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={lostFineAmount}
                          onChange={(e) =>
                            setLostFineAmount(parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded outline-none focus:border-meb-green text-forest dark:text-slate-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleMarkLost}
                          disabled={pending}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-price-red hover:bg-red-700 text-white font-bold px-4 py-2 rounded-md text-sm transition disabled:opacity-60"
                        >
                          {pending ? (
                            <PhosphorIcon name="circle-notch" className="animate-spin" />
                          ) : (
                            <PhosphorIcon name="check" weight="bold" />
                          )}
                          ยืนยันสูญหาย
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLostConfirm(false)}
                          disabled={pending}
                          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}