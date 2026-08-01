"use client";

import { useMemo, useState, useTransition } from "react";
import { PhosphorIcon } from "../../../../components/phosphor-icon";
import { Modal } from "../../../../components/modal";
import {
  approveReturnAction,
  rejectReturnAction,
  type PendingReturnRecord,
} from "../actions";

type ReturnsClientProps = {
  initialRecords: PendingReturnRecord[];
};

const CONDITION_LABEL: Record<string, { label: string; cls: string; icon: string }> = {
  normal: {
    label: "ปกติ",
    cls: "bg-emerald-50 dark:bg-emerald-950/20 text-meb-green border-emerald-100 dark:border-emerald-900/30",
    icon: "check-circle",
  },
  slight_damage: {
    label: "ชำรุดเล็กน้อย",
    cls: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
    icon: "warning-circle",
  },
  damaged: {
    label: "ชำรุดเสียหาย",
    cls: "bg-red-50 dark:bg-red-950/20 text-price-red border-red-100 dark:border-red-900/30",
    icon: "x-circle",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getWaitingDays(requestedAt: string | null): number {
  if (!requestedAt) return 0;
  const ms = Date.now() - new Date(requestedAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function ReturnsClient({ initialRecords }: ReturnsClientProps) {
  const [records, setRecords] = useState<PendingReturnRecord[]>(initialRecords);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // รายการที่กำลังตรวจสอบ
  const [reviewing, setReviewing] = useState<PendingReturnRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ฟอร์มตรวจสอบ
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState<"overdue" | "other" | "lost">("other");
  const [conditionAfter, setConditionAfter] = useState<"normal" | "slight_damage" | "damaged">("normal");
  const [remark, setRemark] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // ใบเสร็จ
  const [receipt, setReceipt] = useState<{ number: string; amount: number; bookTitle: string; memberName: string } | null>(null);

  const stats = useMemo(() => {
    const total = records.length;
    const over7 = records.filter((r) => getWaitingDays(r.return_requested_at) >= 7).length;
    const damaged = records.filter((r) => r.return_condition === "damaged").length;
    return { total, over7, damaged };
  }, [records]);

  function openReview(record: PendingReturnRecord) {
    setReviewing(record);
    setFineAmount("");
    setFineReason("other");
    setConditionAfter(record.return_condition === "damaged" ? "damaged" : record.return_condition === "slight_damage" ? "slight_damage" : "normal");
    setRemark("");
    setRejectReason("");
  }

  async function handleApprove() {
    if (!reviewing) return;
    const amount = parseFloat(fineAmount || "0");
    if (isNaN(amount) || amount < 0) {
      setToast({ type: "error", message: "กรุณากรอกยอดค่าปรับให้ถูกต้อง" });
      return;
    }
    setSubmitting(true);
    setToast(null);

    const formData = new FormData();
    formData.set("record_id", reviewing.id);
    formData.set("fine_amount", String(amount));
    formData.set("fine_reason", fineReason);
    formData.set("remark", remark);
    formData.set("condition_after", conditionAfter);

    const res = await approveReturnAction(formData);

    setSubmitting(false);
    if (res.error) {
      setToast({ type: "error", message: res.error });
    } else {
      setToast({
        type: "success",
        message: amount > 0 && res.receipt?.number
          ? `อนุมัติการคืน + ค่าปรับ ${amount.toLocaleString("en-US")} บาท (ใบเสร็จ ${res.receipt.number})`
          : "อนุมัติการคืนเรียบร้อย",
      });
      setRecords((prev) => prev.filter((r) => r.id !== reviewing.id));
      if (amount > 0 && res.receipt?.number) {
        setReceipt({
          number: res.receipt.number,
          amount,
          bookTitle: reviewing.book_copy?.book?.title ?? "หนังสือ",
          memberName: reviewing.user?.full_name ?? "-",
        });
      }
      setReviewing(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function handleReject() {
    if (!reviewing) return;
    if (!rejectReason.trim()) {
      setToast({ type: "error", message: "กรุณากรอกเหตุผลที่ปฏิเสธ" });
      return;
    }
    setSubmitting(true);
    setToast(null);

    const formData = new FormData();
    formData.set("record_id", reviewing.id);
    formData.set("reason", rejectReason.trim());

    const res = await rejectReturnAction(formData);

    setSubmitting(false);
    if (res.error) {
      setToast({ type: "error", message: res.error });
    } else {
      setToast({ type: "success", message: "ปฏิเสธคำขอกลืนคืนเรียบร้อย — ส่งกลับให้สมาชิก" });
      setRecords((prev) => prev.filter((r) => r.id !== reviewing.id));
      setReviewing(null);
      setTimeout(() => setToast(null), 5000);
    }
  }

  // คำนวณค่าปรับล่วงหน้าตามสภาพ
  const suggestedFine =
    conditionAfter === "damaged"
      ? reviewing?.book_copy?.price ?? 0
      : conditionAfter === "slight_damage"
        ? Math.max(10, Math.round((reviewing?.book_copy?.price ?? 0) * 0.3))
        : 0;

  function useSuggestedFine() {
    if (suggestedFine > 0) setFineAmount(String(suggestedFine));
  }

  return (
    <div className="space-y-6">
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

      {/* หัวข้อ + สถิติ */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center gap-2.5 mb-4">
          <PhosphorIcon name="shield-check" weight="fill" className="text-2xl text-meb-green" />
          <div>
            <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
              ตรวจสอบการคืน
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ตรวจสอบรูปถ่าย + สภาพหนังสือที่สมาชิกส่งคำขอกลืนคืน
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-100 dark:border-border-base p-3 text-center">
            <p className="text-2xl font-bold text-forest dark:text-slate-100">{stats.total}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">รอตรวจสอบ</p>
          </div>
          <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.over7}</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">เกิน 7 วัน (รีบตรวจ!)</p>
          </div>
          <div className="rounded-lg border border-red-100 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5 p-3 text-center">
            <p className="text-2xl font-bold text-price-red">{stats.damaged}</p>
            <p className="text-xs text-price-red/80">แจ้งชำรุด</p>
          </div>
        </div>
      </section>

      {/* รายการรอตรวจสอบ */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="check-circle" className="text-4xl mb-2 text-meb-green/60" />
            <p className="text-sm">ไม่มีคำขอกลืนคืนที่รอตรวจสอบ</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-border-base/40">
            {records.map((record) => {
              const waiting = getWaitingDays(record.return_requested_at);
              const over7 = waiting >= 7;
              const cond = CONDITION_LABEL[record.return_condition ?? "normal"] ?? CONDITION_LABEL.normal;
              const isOverdue = new Date(record.due_date) < new Date();
              return (
                <li key={record.id} className="py-4 flex flex-col sm:flex-row gap-4">
                  {/* รูปถ่ายที่สมาชิกส่ง */}
                  <div className="w-full sm:w-24 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-border-base bg-gray-50 dark:bg-black/20 shrink-0">
                    {record.return_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={record.return_photo_url}
                        alt="รูปถ่ายหนังสือ"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PhosphorIcon name="image" className="text-2xl text-slate-300 dark:text-slate-600" />
                      </div>
                    )}
                  </div>

                  {/* ข้อมูล */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm text-forest dark:text-slate-100 truncate">
                        {record.book_copy?.book?.title ?? "ไม่ระบุชื่อ"}
                      </h3>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border flex items-center gap-1 ${cond.cls}`}>
                        <PhosphorIcon name={cond.icon} weight="fill" className="text-[10px]" />
                        {cond.label}
                      </span>
                      {over7 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <PhosphorIcon name="alarm" weight="fill" className="text-[10px]" />
                          รอ {waiting} วัน
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <p>
                        สมาชิก: <span className="font-bold text-slate-700 dark:text-slate-200">{record.user?.full_name ?? "-"}</span>{" "}
                        ({record.user?.user_id_code ?? "-"})
                      </p>
                      <p className="font-mono">{record.book_copy?.barcode}</p>
                      <p>
                        ยืม {formatDate(record.borrowed_at)} • ครบกำหนด {formatDate(record.due_date)}
                        {isOverdue && <span className="text-price-red font-bold"> (เกินกำหนด)</span>}
                      </p>
                      <p className="text-[11px]">
                        ส่งคำขอเมื่อ {formatDate(record.return_requested_at)} {over7 && <span className="text-amber-600 dark:text-amber-400 font-bold">— ใกล้ครบ 7 วันอัตโนมัติ</span>}
                      </p>
                    </div>
                  </div>

                  {/* ปุ่ม */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => openReview(record)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md transition"
                    >
                      <PhosphorIcon name="magnifying-glass" weight="bold" />
                      ตรวจสอบ
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ====== Modal ตรวจสอบ ====== */}
      <Modal
        open={reviewing !== null}
        onClose={() => setReviewing(null)}
        title="ตรวจสอบคำขอกลืนคืน"
        description={reviewing?.book_copy?.book?.title ?? "หนังสือ"}
        size="lg"
      >
        {reviewing && (
          <div className="space-y-5">
            {/* สภาพที่สมาชิกแจ้ง (สำหรับ modal) */}
            {(() => {
              const rCond = CONDITION_LABEL[reviewing.return_condition ?? "normal"] ?? CONDITION_LABEL.normal;
              return (
                <div className="rounded-lg border border-gray-100 dark:border-border-base p-3 text-xs">
                  <p className="text-slate-400">สภาพที่สมาชิกแจ้ง</p>
                  <p className="font-bold mt-0.5">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border inline-flex items-center gap-1 ${rCond.cls}`}>
                      <PhosphorIcon name={rCond.icon} weight="fill" className="text-[10px]" />
                      {rCond.label}
                    </span>
                  </p>
                </div>
              );
            })()}

            {/* รูปถ่ายใหญ่ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-border-base bg-gray-50 dark:bg-black/20 aspect-[4/3]">
                {reviewing.return_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reviewing.return_photo_url}
                    alt="รูปถ่ายหนังสือ"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PhosphorIcon name="image" className="text-3xl text-slate-300 dark:text-slate-600" />
                  </div>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="rounded-lg border border-gray-100 dark:border-border-base p-3">
                  <p className="text-slate-400">สมาชิก</p>
                  <p className="font-bold text-slate-700 dark:text-slate-200">{reviewing.user?.full_name ?? "-"}</p>
                  <p className="font-mono text-slate-500">{reviewing.user?.user_id_code ?? "-"}</p>
                </div>
                <div className="rounded-lg border border-gray-100 dark:border-border-base p-3">
                  <p className="text-slate-400">หนังสือ</p>
                  <p className="font-bold text-slate-700 dark:text-slate-200">{reviewing.book_copy?.book?.title ?? "-"}</p>
                  <p className="font-mono text-slate-500">{reviewing.book_copy?.barcode}</p>
                </div>
              </div>
            </div>

            {/* สภาพจริงหลังตรวจ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                สภาพหนังสือหลังตรวจสอบ
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "normal", label: "ปกติ", icon: "check-circle" },
                  { value: "slight_damage", label: "ชำรุดเล็กน้อย", icon: "warning-circle" },
                  { value: "damaged", label: "ชำรุดเสียหาย", icon: "x-circle" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConditionAfter(opt.value)}
                    className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-bold transition ${
                      conditionAfter === opt.value
                        ? "border-meb-green bg-meb-light/60 dark:bg-meb-green/10 text-meb-green"
                        : "border-gray-200 dark:border-border-base text-slate-500 dark:text-slate-400 hover:border-meb-green/40"
                    }`}
                  >
                    <PhosphorIcon
                      name={opt.icon}
                      weight="fill"
                      className={conditionAfter === opt.value ? "text-meb-green" : "text-slate-300 dark:text-slate-600"}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ค่าปรับ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  ค่าปรับ (บาท)
                </label>
                <div className="relative">
                  <PhosphorIcon
                    name="currency-dollar"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
                  />
                </div>
                {suggestedFine > 0 && (
                  <button
                    type="button"
                    onClick={useSuggestedFine}
                    className="mt-1.5 text-[11px] text-meb-green hover:underline font-medium"
                  >
                    ใช้ยอดแนะนำ: ฿{suggestedFine.toLocaleString("en-US")}
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  ประเภทค่าปรับ
                </label>
                <select
                  value={fineReason}
                  onChange={(e) => setFineReason(e.target.value as "overdue" | "other" | "lost")}
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100"
                >
                  <option value="overdue">ล่าช้า</option>
                  <option value="other">อื่นๆ</option>
                  <option value="lost">สูญหาย</option>
                </select>
              </div>
            </div>

            {/* หมายเหตุ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                หมายเหตุ
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={2}
                placeholder="บันทึกผลการตรวจสอบ (ถ้ามี)"
                className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100 resize-none"
              />
            </div>

            {/* ปุ่ม */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-3 rounded-md text-sm disabled:opacity-60"
              >
                {submitting ? (
                  <><PhosphorIcon name="circle-notch" className="animate-spin" /> กำลังบันทึก...</>
                ) : (
                  <><PhosphorIcon name="check-circle" weight="fill" /> อนุมัติการคืน</>
                )}
              </button>
              <button
                type="button"
                onClick={() => setReviewing(null)}
                disabled={submitting}
                className="px-5 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition disabled:opacity-60"
              >
                ปิด
              </button>
            </div>

            {/* ปฏิเสธ */}
            <div className="border-t border-gray-100 dark:border-border-base pt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  ปฏิเสธคำขอกลืนคืน <span className="font-normal text-slate-400">(ระบุเหตุผล)</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="เช่น รูปถ่ายไม่ชัด รายละเอียดไม่ตรง..."
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-red-200 dark:border-red-500/30 rounded-md outline-none focus:border-price-red dark:text-slate-100 resize-none"
                />
              </div>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 font-bold px-4 py-2.5 rounded-md text-sm disabled:opacity-60"
              >
                <PhosphorIcon name="x-circle" weight="fill" />
                ปฏิเสธและแจ้งสมาชิก
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ====== Modal ใบเสร็จ ====== */}
      <Modal
        open={receipt !== null}
        onClose={() => setReceipt(null)}
        title="ใบเสร็จค่าปรับ"
        description="ชำระที่เคาน์เตอร์แล้ว — พิมพ์หรือบันทึกไว้เป็นหลักฐาน"
        size="sm"
      >
        {receipt && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-meb-green/40 bg-meb-light/10 dark:bg-meb-green/5 p-4 text-center space-y-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">ใบเสร็จรับเงิน</p>
              <p className="text-sm font-bold text-forest dark:text-slate-100">ANT E-Library</p>
              <p className="text-xl font-bold text-meb-green font-mono">{receipt.number}</p>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1">
                <p>ผู้ชำระ: {receipt.memberName}</p>
                <p>รายการ: ค่าปรับการคืนหนังสือ</p>
                <p>จำนวนเงิน: <span className="font-bold text-price-red">฿{receipt.amount.toLocaleString("en-US")}</span></p>
                <p>ช่องทาง: ชำระที่เคาน์เตอร์</p>
                <p>วันที่: {new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" })}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-3 rounded-md text-sm"
            >
              <PhosphorIcon name="printer" weight="fill" />
              พิมพ์ใบเสร็จ
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
