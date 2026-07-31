"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  payFineAction,
  type MemberBorrowRecord,
  type MemberFineSummary,
} from "../actions";

type MyFinesProps = {
  summary: MemberFineSummary;
  borrows: MemberBorrowRecord[];
  onRefresh: () => void;
};

/**
 * MyFines — แสดงค่าปรับคงค้างของสมาชิก + ปุ่มชำระค่าปรับ
 * สรุปยอดรวม + รายการค่าปรับ + ปุ่มแจ้งชำระ (status='pending')
 */

// ฟอร์แมตวันที่ dd/MM/yyyy
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ป้ายเหตุผลค่าปรับ
function fineReasonLabel(reason: string | null): string {
  if (!reason) return "-";
  if (reason === "overdue") return "เกินกำหนด";
  if (reason === "damaged") return "ชำรุด";
  if (reason === "lost") return "สูญหาย";
  if (reason === "other") return "อื่นๆ";
  return reason;
}

export function MyFines({ summary, borrows, onRefresh }: MyFinesProps) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  // เก็บ record IDs ที่อยู่ระหว่างรอตรวจสอบ (ส่งแล้ว)
  const [pendingPayments, setPendingPayments] = useState<Set<string>>(new Set());

  // กรองเฉพาะรายการที่มีค่าปรับ > 0
  const finedRecords = borrows.filter((b) => b.fine_amount > 0);

  // จัดการชำระค่าปรับ
  async function handlePay(recordId: string) {
    setToast(null);
    const formData = new FormData();
    formData.set("record_id", recordId);
    const res = await payFineAction(formData);
    if (res.error) {
      setToast({ type: "error", message: res.error });
    } else {
      setToast({ type: "success", message: "แจ้งชำระค่าปรับสำเร็จ รอตรวจสอบ" });
      setPendingPayments((prev) => new Set(prev).add(recordId));
      startTransition(() => {
        onRefresh();
      });
    }
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="space-y-5">
      {/* ====== สรุปค่าปรับ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <PhosphorIcon name="currency-dollar" weight="fill" className="text-price-red text-lg" />
          <h2 className="text-base font-bold text-forest dark:text-slate-100">
            สรุปค่าปรับ
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* ยอดค้างชำระ */}
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              ยอดค้างชำระ
            </p>
            <p className="text-2xl font-bold text-price-red">
              ฿{summary.totalUnpaid.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* จำนวนรายการค้าง */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              รายการค้างชำระ
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.unpaidCount}
            </p>
          </div>

          {/* จำนวนรายการที่ชำระแล้ว */}
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              รายการที่ชำระแล้ว
            </p>
            <p className="text-2xl font-bold text-meb-green">
              {summary.paidCount}
            </p>
          </div>
        </div>

        {/* กล่องข้อมูลอัตราค่าปรับ */}
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-black/20 text-xs text-slate-500 dark:text-slate-400">
          <PhosphorIcon name="info" weight="fill" className="text-meb-green shrink-0 mt-0.5" />
          <span>
            ค่าปรับคิด 5 บาท/วัน สำหรับหนังสือที่คืนเกินกำหนด
          </span>
        </div>
      </section>

      {/* Toast */}
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
        </div>
      )}

      {/* ====== รายการค่าปรับ ====== */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <PhosphorIcon name="list-magnifying-glass" weight="fill" className="text-slate-400 dark:text-slate-500 text-lg" />
          <h2 className="text-base font-bold text-forest dark:text-slate-100">
            รายการค่าปรับ
          </h2>
        </div>

        {finedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base text-slate-400 dark:text-slate-500 transition-colors">
            <PhosphorIcon name="check-circle" weight="fill" className="text-5xl mb-2 text-meb-green" />
            <p className="text-sm font-medium">ไม่มีค่าปรับคงค้าง</p>
            <p className="text-xs mt-1">คุณไม่มีค่าปรับที่ต้องชำระในขณะนี้</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {finedRecords.map((record) => {
              const title = record.book_copy?.book?.title ?? "ไม่ระบุชื่อ";
              const barcode = record.book_copy?.barcode ?? "-";
              const isPending = pendingPayments.has(record.id);

              return (
                <div
                  key={record.id}
                  className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-4 flex items-center gap-3 transition hover:shadow-sm"
                >
                  {/* ปกหนังสือ */}
                  <div className="w-9 h-12 rounded overflow-hidden border border-gray-200 dark:border-border-base shrink-0 bg-gray-50 dark:bg-black/20 flex items-center justify-center">
                    {record.book_copy?.book?.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={record.book_copy.book.cover_image_url}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <PhosphorIcon name="book" className="text-slate-300 dark:text-slate-600 text-sm" />
                    )}
                  </div>

                  {/* รายละเอียด */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-forest dark:text-slate-100 truncate">
                      {title}
                    </h3>
                    <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono">{barcode}</span>
                      {record.returned_at && (
                        <span>คืน: {formatDate(record.returned_at)}</span>
                      )}
                      <span className="text-price-red font-medium">
                        {fineReasonLabel(record.fine_reason)}
                      </span>
                    </div>
                  </div>

                  {/* ยอดค่าปรับ */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-price-red text-base">
                      ฿{record.fine_amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* ปุ่มชำระ / สถานะ */}
                  <div className="shrink-0">
                    {isPending || record.status === "returned" ? (
                      // ตรวจสอบว่าชำระแล้วหรือรอตรวจสอบ
                      isPending ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-md border border-amber-100 dark:border-amber-900/30">
                          <PhosphorIcon name="hourglass" weight="fill" className="text-sm" />
                          รอตรวจสอบ
                        </span>
                      ) : record.fine_amount > 0 ? (
                        <button
                          type="button"
                          onClick={() => handlePay(record.id)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md transition disabled:opacity-60"
                        >
                          <PhosphorIcon name="currency-dollar" weight="bold" className="text-sm" />
                          ชำระค่าปรับ
                        </button>
                      ) : null
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePay(record.id)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md transition disabled:opacity-60"
                      >
                        <PhosphorIcon name="currency-dollar" weight="bold" className="text-sm" />
                        ชำระค่าปรับ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}