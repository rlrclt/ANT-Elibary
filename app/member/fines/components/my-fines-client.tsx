"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  getFineBalanceAction,
  getMyFinesAction,
  getPaymentMethodsAction,
  choosePaymentMethodAction,
  cancelPaymentAction,
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

function fineTypeIcon(t: string): string {
  switch (t) {
    case "overdue":
      return "clock";
    case "damaged":
      return "warning";
    case "lost":
      return "book";
    default:
      return "currency-dollar";
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "unpaid":
      return "ยังไม่ชำระ";
    case "counter_pending":
      return "รอชำระที่เคาน์เตอร์";
    case "pending":
      return "รอตรวจสอบ";
    case "approved":
      return "อนุมัติแล้ว";
    case "rejected":
      return "ไม่อนุมัติ";
    case "counter_paid":
      return "ชำระที่เคาน์เตอร์แล้ว";
    default:
      return s;
  }
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "unpaid":
      return "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-900/30";
    case "counter_pending":
      return "bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-900/30";
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

function statusIcon(s: string): string {
  switch (s) {
    case "approved":
      return "check-circle";
    case "rejected":
      return "x-circle";
    case "counter_pending":
      return "storefront";
    case "unpaid":
      return "currency-circle-dollar";
    default:
      return "hourglass";
  }
}

// ---------- Component ----------
export function MyFinesClient({
  initialBalance = 0,
  initialFines = [],
  initialMethods = [],
}: {
  initialBalance?: number;
  initialFines?: MyFinePayment[];
  initialMethods?: MemberPaymentMethod[];
}) {
  const [balance, setBalance] = useState<number>(initialBalance);
  const [fines, setFines] = useState<MyFinePayment[]>(initialFines);
  const [methods] = useState<MemberPaymentMethod[]>(initialMethods);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showPayInfo, setShowPayInfo] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const qrSectionRef = useRef<HTMLDivElement>(null);

  // เคลียร์ toast อัตโนมัติ
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // โหลดข้อมูลใหม่ (หลังแนบสลิป)
  async function loadData() {
    const [balRes, finesRes] = await Promise.all([
      getFineBalanceAction(),
      getMyFinesAction(),
    ]);
    if (balRes.data !== null) setBalance(balRes.data);
    if (finesRes.data) setFines(finesRes.data);
  }

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

  // เลือกวิธีชำระ (โอนเงิน / เงินสดที่เคาน์เตอร์)
  async function handleChooseMethod(fineId: string, method: "transfer" | "counter") {
    setToast(null);
    const formData = new FormData();
    formData.set("fine_id", fineId);
    formData.set("method", method);
    const res = await choosePaymentMethodAction(formData);
    if (res.error) {
      setToast({ type: "error", message: res.error });
    } else {
      setToast({
        type: "success",
        message:
          method === "counter"
            ? "แจ้งชำระเงินสดที่เคาน์เตอร์แล้ว รอเจ้าหน้าที่รับเงิน"
            : "เลือกชำระแบบโอนเงินแล้ว กรุณาแนบสลิป",
      });
      startTransition(() => {
        loadData();
      });
    }
  }

  // ยกเลิกการชำระเพื่อเลือกวิธีใหม่ (เผื่อกดผิด)
  async function handleCancelPayment(fineId: string) {
    if (!confirm("ต้องการยกเลิกการชำระรายการนี้ แล้วเลือกวิธีชำระใหม่ ใช่หรือไม่?")) return;
    setToast(null);
    const formData = new FormData();
    formData.set("fine_id", fineId);
    const res = await cancelPaymentAction(formData);
    if (res.error) {
      setToast({ type: "error", message: res.error });
    } else {
      setToast({ type: "success", message: "ยกเลิกการชำระแล้ว กรุณาเลือกวิธีชำระใหม่" });
      startTransition(() => {
        loadData();
      });
    }
  }

  // คัดลอกเลขบัญชี
  async function handleCopyAccount(accountNumber: string) {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setToast({ type: "success", message: "คัดลอกเลขบัญชีแล้ว" });
    } catch {
      setToast({ type: "error", message: "คัดลอกไม่สำเร็จ กรุณากดคัดลอกเอง" });
    }
  }

  // เลื่อนขึ้นไปส่วนรายการค่าปรับ
  function scrollToFines() {
    document
      .getElementById("fine-list")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const hasOutstanding = balance > 0;

  return (
    <div className="space-y-5">
      {/* ====== ข้อมูลวิธีชำระ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base overflow-hidden transition-colors">
        <button
          type="button"
          onClick={() => setShowPayInfo((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-black/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-meb-green/10 text-meb-green flex items-center justify-center shrink-0">
              <PhosphorIcon name="info" weight="fill" className="text-xl" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-forest dark:text-slate-100">
                วิธีชำระค่าปรับ
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เลือกชำระได้ 2 แบบ — โอนเงิน หรือ จ่ายเงินสดที่เคาน์เตอร์
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-colors ${
              showPayInfo
                ? "bg-meb-green text-white"
                : "bg-meb-light dark:bg-meb-green/10 text-meb-green"
            }`}
          >
            <PhosphorIcon
              name={showPayInfo ? "eye" : "book-open-text"}
              weight="fill"
              className="text-sm"
            />
            {showPayInfo ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
          </span>
        </button>

        {showPayInfo && (
          <div className="px-5 pb-5 pt-1 space-y-4 animate-fade-in border-t border-gray-100 dark:border-border-base">
            {/* สองวิธีชำระ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* วิธีที่ 1: โอนเงิน */}
              <div className="rounded-xl border border-meb-green/25 bg-meb-light/40 dark:bg-meb-green/10 p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-meb-green text-white flex items-center justify-center shrink-0">
                    <PhosphorIcon name="qr-code" weight="fill" className="text-lg" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-forest dark:text-slate-100">
                      วิธีที่ 1 · โอนเงิน
                    </p>
                    <p className="text-[11px] text-meb-green font-medium">
                      QR Code / บัญชีธนาคาร
                    </p>
                  </div>
                </div>
                <ol className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {[
                    "กดปุ่ม \"โอนเงิน (แนบสลิป)\" ในรายการค่าปรับ",
                    "โอนเงินตาม QR Code หรือเลขบัญชีด้านล่าง",
                    "แนบสลิปหลักฐานการโอนในระบบ",
                    "รอเจ้าหน้าที่ตรวจสอบและอนุมัติ",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-meb-green/15 text-meb-green text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* วิธีที่ 2: เงินสดที่เคาน์เตอร์ */}
              <div className="rounded-xl border border-terracotta/25 bg-terracotta/5 dark:bg-terracotta/10 p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-terracotta text-white flex items-center justify-center shrink-0">
                    <PhosphorIcon name="storefront" weight="fill" className="text-lg" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-forest dark:text-slate-100">
                      วิธีที่ 2 · จ่ายเงินสด
                    </p>
                    <p className="text-[11px] text-terracotta font-medium">
                      ที่เคาน์เตอร์ห้องสมุด
                    </p>
                  </div>
                </div>
                <ol className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {[
                    "กดปุ่ม \"จ่ายเงินสดที่เคาน์เตอร์\" ในรายการค่าปรับ",
                    "นำเงินสดมาชำระที่ห้องสมุดตามจำนวนที่ระบุ",
                    "เจ้าหน้าที่รับเงินและออกใบเสร็จให้ทันที",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-terracotta/15 text-terracotta text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* ข้อมูลบัญชี / QR */}
            {methods.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                  <PhosphorIcon name="bank" weight="fill" className="text-meb-green" />
                  ข้อมูลบัญชีสำหรับโอนเงิน
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {methods.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg border border-gray-100 dark:border-border-base bg-white dark:bg-card-bg flex items-center gap-3"
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                        {m.qr_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.qr_image_url}
                            alt={m.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <PhosphorIcon name="qr-code" weight="fill" className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-forest dark:text-slate-100 truncate">
                          {m.name}
                        </p>
                        {m.account_name && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {m.account_name}
                          </p>
                        )}
                        {m.account_number && (
                          <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate">
                            {m.account_number}
                          </p>
                        )}
                      </div>
                      {m.account_number && (
                        <button
                          type="button"
                          onClick={() => handleCopyAccount(m.account_number!)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-meb-green bg-meb-light dark:bg-meb-green/10 hover:bg-meb-green/20 rounded-md transition disabled:opacity-60 shrink-0"
                        >
                          <PhosphorIcon name="copy" weight="bold" className="text-xs" />
                          คัดลอก
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-900/30">
              <PhosphorIcon name="warning" weight="fill" className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                หากเลือกวิธีชำระผิดหรือแนบสลิปผิดพลาด กดปุ่ม "ยกเลิก / เปลี่ยนวิธี" ในรายการค่าปรับเพื่อเลือกใหม่ได้เสมอ
              </span>
            </p>
          </div>
        )}
      </section>

      {/* ====== ขั้นตอนการชำระ (เฉพาะมียอดค้าง) ====== */}
      {hasOutstanding && (
        <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors animate-fade-in">
          <h2 className="text-sm font-bold text-forest dark:text-slate-100 mb-4 flex items-center gap-2">
            <PhosphorIcon
              name="steps"
              weight="fill"
              className="text-meb-green text-lg"
            />
            ชำระค่าปรับ 3 ขั้นตอน
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: 1,
                title: "เลือกวิธีชำระ",
                desc: "เลือก \"โอนเงิน\" หรือ \"จ่ายเงินสดที่เคาน์เตอร์\" ในรายการค่าปรับ",
                icon: "hand-coins",
              },
              {
                step: 2,
                title: "ชำระเงิน",
                desc: "โอนตาม QR / บัญชี แล้วแนบสลิป หรือนำเงินสดมาชำระที่ห้องสมุด",
                icon: "qr-code",
              },
              {
                step: 3,
                title: "รอเจ้าหน้าที่ตรวจสอบ",
                desc: "ติดตามสถานะได้ที่นี่ ระบบจะแจ้งผลให้ทราบ",
                icon: "hourglass",
              },
            ].map((s, i) => (
              <div
                key={s.step}
                className="relative flex gap-3 rounded-lg border border-gray-100 dark:border-border-base bg-slate-50/50 dark:bg-black/10 p-4"
              >
                {i < 2 && (
                  <div className="hidden sm:block absolute top-1/2 -right-2.5 z-10 text-slate-300 dark:text-slate-600">
                    <PhosphorIcon name="caret-right" weight="fill" />
                  </div>
                )}
                <div className="w-8 h-8 rounded-full bg-meb-green text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {s.step}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-forest dark:text-slate-100 flex items-center gap-1.5">
                    <PhosphorIcon name={s.icon} className="text-meb-green" />
                    {s.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ====== วิธีชำระเงิน QR/บัญชี (เฉพาะมียอดค้าง) ====== */}
      {hasOutstanding && methods.length > 0 && (
        <section
          ref={qrSectionRef}
          className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors"
        >
          <div className="flex items-center gap-2 mb-4">
            <PhosphorIcon
              name="qr-code"
              weight="fill"
              className="text-meb-green text-lg"
            />
            <h2 className="text-base font-bold text-forest dark:text-slate-100">
              วิธีชำระเงิน
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {methods.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-gray-100 dark:border-border-base bg-slate-50/50 dark:bg-black/10 flex flex-col items-center text-center gap-3 card-lift"
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
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                        {m.account_number}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyAccount(m.account_number!)}
                        disabled={pending}
                        title="คัดลอกเลขบัญชี"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-meb-green bg-meb-light dark:bg-meb-green/10 hover:bg-meb-green/20 rounded-md transition disabled:opacity-60"
                      >
                        <PhosphorIcon name="copy" weight="bold" className="text-xs" />
                        คัดลอก
                      </button>
                    </div>
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
              กรุณาโอนเงินตามบัญชีข้างต้น แล้วกด{" "}
              <button
                type="button"
                onClick={scrollToFines}
                className="font-bold text-meb-green hover:underline"
              >
                แนบสลิป
              </button>{" "}
              ในรายการค่าปรับด้านล่าง
            </span>
          </div>
        </section>
      )}

      {/* ====== Toast ====== */}
      {toast && (
        <div
          className={`p-3.5 rounded-lg text-sm font-medium animate-fade-in ${
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
      <section id="fine-list" className="scroll-mt-32">
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
          <div className="flex flex-col items-center justify-center py-14 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base text-center transition-colors">
            <div className="w-16 h-16 rounded-full bg-meb-light dark:bg-meb-green/10 flex items-center justify-center text-meb-green mb-3">
              <PhosphorIcon name="check-circle" weight="fill" className="text-3xl" />
            </div>
            <p className="text-sm font-medium text-forest dark:text-slate-100">
              ไม่มีรายการค่าปรับ
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base overflow-x-auto transition-colors">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-border-base text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">ประเภท</th>
                  <th className="px-4 py-3 font-medium">รายละเอียด</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-4 py-3 font-medium text-right">ยอด</th>
                  <th className="px-4 py-3 font-medium">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {fines.map((fine) => (
                  <FineRow
                    key={fine.id}
                    fine={fine}
                    pending={pending}
                    onChooseMethod={handleChooseMethod}
                    onCancelPayment={handleCancelPayment}
                    onPickFile={handlePickFile}
                    onUploadSlip={handleUploadSlip}
                    fileInputRef={(el) => {
                      fileInputRefs.current[fine.id] = el;
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- FineRow (รายการค่าปรับแบบแถวตาราง) ----------
function FineRow({
  fine,
  pending,
  onChooseMethod,
  onCancelPayment,
  onPickFile,
  onUploadSlip,
  fileInputRef,
}: {
  fine: MyFinePayment;
  pending: boolean;
  onChooseMethod: (id: string, method: "transfer" | "counter") => void;
  onCancelPayment: (id: string) => void;
  onPickFile: (id: string) => void;
  onUploadSlip: (id: string, file: File) => void;
  fileInputRef: (el: HTMLInputElement | null) => void;
}) {
  const isUnpaidNoMethod = fine.status === "unpaid" && !fine.payment_method;
  const isSlipArea =
    fine.status === "pending" ||
    (fine.status === "unpaid" && fine.payment_method === "transfer") ||
    fine.status === "rejected";

  return (
    <tr className="border-b border-gray-50 dark:border-border-base last:border-0 align-top">
      {/* ประเภท */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-meb-light dark:bg-meb-green/10 text-meb-green border border-meb-green/10">
          <PhosphorIcon name={fineTypeIcon(fine.fine_type)} className="text-sm" />
          {fineTypeLabel(fine.fine_type)}
        </span>
      </td>

      {/* รายละเอียด */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {fine.description ?? "—"}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
          <span className="flex items-center gap-1">
            <PhosphorIcon name="calendar" className="text-sm" />
            สร้างเมื่อ {formatDate(fine.created_at)}
          </span>
          {fine.reviewed_at && (
            <span className="flex items-center gap-1">
              <PhosphorIcon name="check-square" className="text-sm" />
              ตรวจเมื่อ {formatDate(fine.reviewed_at)}
            </span>
          )}
        </div>
        {fine.status === "rejected" && fine.review_note && (
          <div className="mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-900/30 flex items-start gap-1.5">
            <PhosphorIcon
              name="warning-circle"
              weight="fill"
              className="text-price-red shrink-0 mt-0.5"
            />
            <p className="text-xs text-price-red font-medium">{fine.review_note}</p>
          </div>
        )}
        {isSlipArea && fine.slip_url && (
          <div className="mt-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fine.slip_url}
              alt="สลิปที่แนบ"
              className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-border-base"
            />
            <span className="text-xs text-slate-400">
              สลิปที่แนบ{fine.slip_uploaded_at && ` ${formatDate(fine.slip_uploaded_at)}`}
            </span>
          </div>
        )}
      </td>

      {/* สถานะ */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md border whitespace-nowrap ${statusBadgeClass(
            fine.status,
          )}`}
        >
          <PhosphorIcon name={statusIcon(fine.status)} weight="fill" className="text-sm" />
          {statusLabel(fine.status)}
        </span>
      </td>

      {/* ยอด */}
      <td className="px-4 py-3 font-bold text-price-red whitespace-nowrap text-right">
        ฿{formatMoney(fine.amount)}
      </td>

      {/* การดำเนินการ */}
      <td className="px-4 py-3 min-w-[200px]">
        {isUnpaidNoMethod && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onChooseMethod(fine.id, "transfer")}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md transition disabled:opacity-60"
            >
              <PhosphorIcon name="qr-code" weight="bold" className="text-sm" />
              โอนเงิน (แนบสลิป)
            </button>
            <button
              type="button"
              onClick={() => onChooseMethod(fine.id, "counter")}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-meb-green bg-meb-light dark:bg-meb-green/10 hover:bg-meb-green/20 rounded-md transition disabled:opacity-60"
            >
              <PhosphorIcon name="storefront" weight="bold" className="text-sm" />
              จ่ายเงินสดที่เคาน์เตอร์
            </button>
          </div>
        )}

        {fine.status === "counter_pending" && (
          <button
            type="button"
            onClick={() => onCancelPayment(fine.id)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/10 hover:bg-sky-200 dark:hover:bg-sky-500/20 rounded-md transition disabled:opacity-60"
          >
            <PhosphorIcon name="arrow-counter-clockwise" weight="bold" className="text-sm" />
            ยกเลิก / เปลี่ยนวิธี
          </button>
        )}

        {isSlipArea && (
          <div className="flex flex-col gap-1.5">
            {fine.slip_url ? (
              <button
                type="button"
                onClick={() => onPickFile(fine.id)}
                disabled={pending}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-meb-green bg-meb-light dark:bg-meb-green/10 hover:bg-meb-green/20 rounded-md transition disabled:opacity-60"
              >
                <PhosphorIcon name="arrows-clockwise" className="text-sm" />
                แนบสลิปใหม่
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onPickFile(fine.id)}
                disabled={pending}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md transition disabled:opacity-60"
              >
                <PhosphorIcon name="paperclip" weight="bold" className="text-sm" />
                แนบสลิป
              </button>
            )}
            <button
              type="button"
              onClick={() => onCancelPayment(fine.id)}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-price-red dark:text-slate-400 bg-slate-50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-500/10 border border-gray-100 dark:border-border-base rounded-md transition disabled:opacity-60"
            >
              <PhosphorIcon name="arrow-counter-clockwise" weight="bold" className="text-sm" />
              ยกเลิก / เปลี่ยนวิธี
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadSlip(fine.id, f);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </td>
    </tr>
  );
}
