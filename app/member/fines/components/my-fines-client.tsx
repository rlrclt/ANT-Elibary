"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  getFineBalanceAction,
  getMyFinesAction,
  getPaymentMethodsAction,
  uploadSlipAction,
  type MemberPaymentMethod,
  type MyFinePayment,
} from "../actions";

// ---------- Helpers ----------
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fineTypeLabel(t: string): string {
  switch (t) {
    case "overdue":
      return "เกินกำหนด";
    case "damaged":
      return "ชำรุด";
    case "lost":
      return "สูญหาย";
    case "other":
      return "อื่นๆ";
    default:
      return t;
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "รอตรวจสอบ";
    case "approved":
      return "อนุมัติแล้ว";
    case "rejected":
      return "ไม่อนุมัติ";
    case "counter_paid":
      return "ชำระที่เคาน์เตอร์";
    default:
      return s;
  }
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "pending":
      return "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-900/30";
    case "approved":
      return "bg-emerald-50 text-meb-green border-emerald-100 dark:bg-meb-green/10 dark:text-meb-green dark:border-emerald-900/30";
    case "rejected":
      return "bg-red-50 text-price-red border-red-100 dark:bg-red-500/10 dark:text-price-red dark:border-red-900/30";
    default:
      return "bg-slate-50 text-slate-500 border-slate-100 dark:bg-black/20 dark:text-slate-400 dark:border-border-base";
  }
}

// ---------- Component ----------
export function MyFinesClient() {
  const [balance, setBalance] = useState<number | null>(null);
  const [fines, setFines] = useState<MyFinePayment[]>([]);
  const [methods, setMethods] = useState<MemberPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // โหลดข้อมูลตอน mount
  async function loadData() {
    const [balRes, finesRes, methodsRes] = await Promise.all([
      getFineBalanceAction(),
      getMyFinesAction(),
      getPaymentMethodsAction(),
    ]);
    if (balRes.data !== null) setBalance(balRes.data);
    if (finesRes.data) setFines(finesRes.data);
    if (methodsRes.data) setMethods(methodsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // เคลียร์ toast อัตโนมัติ
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // เปิด file picker สำหรับรายการที่เลือก
  function handlePickFile(fineId: string) {
    const input = fileInputRefs.current[fineId];
    if (input) input.click();
  }

  // อัปโหลดสลิป
  async function handleUploadSlip(fineId: string, file: File) {
    setToast(null);
    const formData = new FormData();
    formData.set("fine_id", fineId);
    formData.set("slip", file);
    const res = await uploadSlipAction(formData);
    if (res.error) {
      setToast({ type: "error", message: res.error });
    } else {
      setToast({ type: "success", message: "แนบสลิปสำเร็จ รอตรวจสอบ" });
      startTransition(() => {
        loadData();
      });
    }
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <PhosphorIcon name="circle-notch" className="animate-spin text-2xl" />
        <span className="ml-2 text-sm">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ====== สรุปยอดค่าปรับ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <PhosphorIcon
            name="currency-dollar"
            weight="fill"
            className="text-price-red text-lg"
          />
          <h2 className="text-base font-bold text-forest dark:text-slate-100">
            สรุปค่าปรับ
          </h2>
        </div>

        <div className="p-4 rounded-xl border border-gray-100 dark:border-border-base flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                balance && balance > 0
                  ? "bg-red-50 dark:bg-red-500/10 text-price-red"
                  : "bg-emerald-50 dark:bg-meb-green/10 text-meb-green"
              }`}
            >
              <PhosphorIcon
                name={balance && balance > 0 ? "warning" : "check-circle"}
                weight="fill"
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ยอดค่าปรับคงค้าง
              </p>
              {balance !== null && balance > 0 ? (
                <p className="text-2xl font-bold text-price-red">
                  ฿{formatMoney(balance)}
                </p>
              ) : (
                <p className="text-lg font-bold text-meb-green">
                  ไม่มีค่าปรับค้างชำระ
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ====== วิธีการชำระเงิน (QR) ====== */}
      {methods.length > 0 && (
        <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <PhosphorIcon
              name="qr-code"
              weight="fill"
              className="text-meb-green text-lg"
            />
            <h2 className="text-base font-bold text-forest dark:text-slate-100">
              วิธีการชำระเงิน
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {methods.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-gray-100 dark:border-border-base bg-slate-50/50 dark:bg-black/10 flex flex-col items-center text-center gap-3"
              >
                {m.qr_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.qr_image_url}
                    alt={m.name}
                    className="w-32 h-32 object-contain rounded-lg border border-gray-100 dark:border-border-base bg-white"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-lg border border-dashed border-gray-200 dark:border-border-base flex items-center justify-center text-slate-300 dark:text-slate-600">
                    <PhosphorIcon name="qr-code" className="text-4xl" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-sm text-forest dark:text-slate-100">
                    {m.name}
                  </p>
                  {m.account_name && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {m.account_name}
                    </p>
                  )}
                  {m.account_number && (
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                      {m.account_number}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-black/20 text-xs text-slate-500 dark:text-slate-400">
            <PhosphorIcon
              name="info"
              weight="fill"
              className="text-meb-green shrink-0 mt-0.5"
            />
            <span>
              กรุณาโอนเงินตามบัญชีข้างต้น แล้วแนบสลิปการโอนเงินในรายการค่าปรับด้านล่าง
            </span>
          </div>
        </section>
      )}

      {/* ====== Toast ====== */}
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
          <PhosphorIcon
            name="list-bullets"
            weight="fill"
            className="text-slate-400 dark:text-slate-500 text-lg"
          />
          <h2 className="text-base font-bold text-forest dark:text-slate-100">
            รายการค่าปรับ
          </h2>
          {fines.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-meb-green rounded-full">
              {fines.length}
            </span>
          )}
        </div>

        {fines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base text-slate-400 dark:text-slate-500 transition-colors">
            <PhosphorIcon
              name="check-circle"
              weight="fill"
              className="text-5xl mb-2 text-meb-green"
            />
            <p className="text-sm font-medium">ไม่มีรายการค่าปรับ</p>
            <p className="text-xs mt-1">คุณไม่มีค่าปรับที่ต้องชำระในขณะนี้</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fines.map((fine) => (
              <div
                key={fine.id}
                className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-4 transition hover:shadow-sm"
              >
                {/* บรรทัดบน: badge + ยอด */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-md bg-meb-light dark:bg-meb-green/10 text-meb-green border border-meb-green/10">
                      {fineTypeLabel(fine.fine_type)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md border ${statusBadgeClass(
                        fine.status,
                      )}`}
                    >
                      <PhosphorIcon
                        name={
                          fine.status === "approved"
                            ? "check-circle"
                            : fine.status === "rejected"
                              ? "x-circle"
                              : "hourglass"
                        }
                        weight="fill"
                        className="text-sm"
                      />
                      {statusLabel(fine.status)}
                    </span>
                  </div>
                  <p className="font-bold text-price-red text-lg shrink-0">
                    ฿{formatMoney(fine.amount)}
                  </p>
                </div>

                {/* รายละเอียด */}
                {fine.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                    {fine.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <PhosphorIcon name="calendar" className="text-sm" />
                    {formatDate(fine.created_at)}
                  </span>
                  {fine.reviewed_at && (
                    <span className="flex items-center gap-1">
                      <PhosphorIcon name="check-square" className="text-sm" />
                      ตรวจสอบเมื่อ {formatDate(fine.reviewed_at)}
                    </span>
                  )}
                </div>

                {/* ถ้าถูกปฏิเสธ → แสดง review_note */}
                {fine.status === "rejected" && fine.review_note && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-900/30 flex items-start gap-2">
                    <PhosphorIcon
                      name="warning-circle"
                      weight="fill"
                      className="text-price-red shrink-0 mt-0.5"
                    />
                    <p className="text-xs text-price-red font-medium">
                      {fine.review_note}
                    </p>
                  </div>
                )}

                {/* ส่วนสลิป (เฉพาะ pending) */}
                {fine.status === "pending" && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-border-base">
                    {fine.slip_url ? (
                      // แนบสลิปแล้ว → แสดง thumbnail + สถานะ
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fine.slip_url}
                          alt="สลิปที่แนบ"
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-border-base"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <PhosphorIcon
                              name="hourglass"
                              weight="fill"
                              className="text-sm"
                            />
                            รอตรวจสอบ
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            สลิปที่แนบ
                            {fine.slip_uploaded_at &&
                              ` เมื่อ ${formatDate(fine.slip_uploaded_at)}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePickFile(fine.id)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-meb-green bg-meb-light dark:bg-meb-green/10 hover:bg-meb-green/20 rounded-md transition disabled:opacity-60"
                        >
                          <PhosphorIcon name="arrows-clockwise" className="text-sm" />
                          แนบใหม่
                        </button>
                      </div>
                    ) : (
                      // ยังไม่แนบสลิป → ปุ่มแนบสลิป
                      <button
                        type="button"
                        onClick={() => handlePickFile(fine.id)}
                        disabled={pending}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover rounded-lg transition disabled:opacity-60"
                      >
                        <PhosphorIcon name="paperclip" weight="bold" className="text-base" />
                        แนบสลิป
                      </button>
                    )}
                    {/* hidden file input */}
                    <input
                      ref={(el) => {
                        fileInputRefs.current[fine.id] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadSlip(fine.id, f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}