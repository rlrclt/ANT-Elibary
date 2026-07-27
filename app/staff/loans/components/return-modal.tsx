"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Modal } from "../../../components/modal";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  searchMemberAction,
  getMemberActiveBorrowsAction,
  returnBookAction,
  type BorrowRecord,
} from "../actions";

// อัตราค่าปรับต่อวัน (บาท) — ค่าปรับเกินกำหนด
const FINE_PER_DAY = 5;

/**
 * return-modal — ฟอร์มคืนหนังสือแบบหลายขั้นตอน
 * Step 1: ค้นหา/เลือกสมาชิก
 * Step 2: เลือกหนังสือที่จะคืน (สแกนบาร์โค้ดหรือคลิกจากรายการ)
 * Step 3: คำนวณค่าปรับ + ยืนยันการคืน
 */
type ReturnModalProps = {
  open: boolean;
  onClose: () => void;
};

// ข้อมูลสมาชิกที่เลือก
type SelectedMember = {
  id: string;
  full_name: string;
  user_id_code: string;
  role: string;
  status: string;
};

// รายการที่เลือกจะคืน พร้อมฟิลด์ค่าปรับ
type ReturnItem = {
  record: BorrowRecord;
  fineAmount: number;
  fineReason: "overdue" | "damaged" | "lost" | "other" | "";
  remark: string;
};

// ฟอร์แมตวันที่ dd/MM/yyyy
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// คำนวณจำนวนวันเกินกำหนด
function daysOverdue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = today.getTime() - due.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// คำนวณค่าปรับแนะนำ (เกินกำหนด × 5 บาท/วัน)
function suggestedFine(record: BorrowRecord): number {
  const days = daysOverdue(record.due_date);
  if (record.status === "overdue" || days > 0) {
    return Math.max(0, days) * FINE_PER_DAY;
  }
  return 0;
}

// ดึง 2 ตัวอักษรแรกของชื่อ
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ReturnModal({ open, onClose }: ReturnModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [success, setSuccess] = useState(false);
  const [totalFinesCharged, setTotalFinesCharged] = useState(0);

  // Step 1 — search member
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<SelectedMember[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Step 2 — active borrows + selection
  const [activeBorrows, setActiveBorrows] = useState<BorrowRecord[]>([]);
  const [loadingBorrows, setLoadingBorrows] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Step 3 — confirm
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // reset เมื่อปิด modal
  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep(1);
      setSuccess(false);
      setTotalFinesCharged(0);
      setMemberQuery("");
      setMemberResults([]);
      setSelectedMember(null);
      setMemberError(null);
      setActiveBorrows([]);
      setReturnItems([]);
      setBarcodeInput("");
      setScanError(null);
      setProgress(null);
      setConfirmError(null);
    }, 150);
  }

  // โฟกัสช่องสแกนเมื่อเข้า step 2
  useEffect(() => {
    if (open && step === 2 && barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, [open, step]);

  // ค้นหาสมาชิก
  function handleSearchMember(e: React.FormEvent) {
    e.preventDefault();
    setMemberError(null);
    setMemberSearching(true);
    searchMemberAction(memberQuery)
      .then((res) => {
        if (res.error) {
          setMemberError(res.error);
          setMemberResults([]);
        } else {
          setMemberResults(res.data);
        }
      })
      .finally(() => setMemberSearching(false));
  }

  // เลือกสมาชิก → ดึงรายการยืมปัจจุบัน
  async function handleSelectMember(m: SelectedMember) {
    setSelectedMember(m);
    setMemberError(null);
    setLoadingBorrows(true);
    const res = await getMemberActiveBorrowsAction(m.id);
    if (res.error) {
      setMemberError(res.error);
      setActiveBorrows([]);
    } else {
      setActiveBorrows(res.data ?? []);
    }
    setLoadingBorrows(false);
    setStep(2);
  }

  // ตรวจว่ารายการอยู่ในที่เลือกแล้วหรือไม่
  function isSelected(recordId: string): boolean {
    return returnItems.some((r) => r.record.id === recordId);
  }

  // สแกนบาร์โค้ด → ค้นหารายการที่ตรงแล้วเลือก
  function handleScanBarcode(e: React.FormEvent) {
    e.preventDefault();
    const b = barcodeInput.trim();
    if (!b) return;
    setScanError(null);

    const found = activeBorrows.find(
      (r) => r.book_copy?.barcode === b,
    );
    if (!found) {
      setScanError("ไม่พบบาร์โค้ดนี้ในรายการยืมของสมาชิก");
      setBarcodeInput("");
      return;
    }
    if (isSelected(found.id)) {
      setScanError("เล่มนี้ถูกเลือกเพื่อคืนแล้ว");
      setBarcodeInput("");
      return;
    }
    addReturnItem(found);
    setBarcodeInput("");
  }

  // เพิ่มรายการที่จะคืน
  function addReturnItem(record: BorrowRecord) {
    const suggested = suggestedFine(record);
    setReturnItems([
      ...returnItems,
      {
        record,
        fineAmount: suggested,
        fineReason: suggested > 0 ? "overdue" : "",
        remark: "",
      },
    ]);
  }

  // ลบรายการออกจากที่เลือก
  function removeReturnItem(recordId: string) {
    setReturnItems(returnItems.filter((r) => r.record.id !== recordId));
  }

  // แก้ค่าปรับ
  function updateFineAmount(recordId: string, amount: number) {
    setReturnItems(
      returnItems.map((r) =>
        r.record.id === recordId ? { ...r, fineAmount: amount } : r,
      ),
    );
  }

  // แก่เหตุผลค่าปรับ
  function updateFineReason(
    recordId: string,
    reason: ReturnItem["fineReason"],
  ) {
    setReturnItems(
      returnItems.map((r) =>
        r.record.id === recordId ? { ...r, fineReason: reason } : r,
      ),
    );
  }

  // แก้หมายเหตุ
  function updateRemark(recordId: string, remark: string) {
    setReturnItems(
      returnItems.map((r) =>
        r.record.id === recordId ? { ...r, remark } : r,
      ),
    );
  }

  // ยืนยันการคืน → เรียก returnBookAction ทีละเล่ม
  function handleConfirm() {
    if (returnItems.length === 0) return;
    setConfirmError(null);
    setProgress({ done: 0, total: returnItems.length });

    startTransition(async () => {
      let failed = 0;
      let lastErr = "";
      let totalFines = 0;
      for (let i = 0; i < returnItems.length; i++) {
        const item = returnItems[i];
        const formData = new FormData();
        formData.set("record_id", item.record.id);
        if (item.fineAmount > 0) {
          formData.set("fine_amount", item.fineAmount.toString());
          formData.set("fine_reason", item.fineReason || "overdue");
        }
        if (item.remark) {
          formData.set("remark", item.remark);
        }
        const res = await returnBookAction(formData);
        if (res.error) {
          failed++;
          lastErr = res.error;
        } else {
          totalFines += item.fineAmount;
        }
        setProgress({ done: i + 1, total: returnItems.length });
      }
      if (failed === returnItems.length) {
        setConfirmError(lastErr);
        setProgress(null);
      } else if (failed > 0) {
        setConfirmError(`คืนสำเร็จ ${returnItems.length - failed} เล่ม ล้มเหลว ${failed} เล่ม (${lastErr})`);
        setTotalFinesCharged(totalFines);
        setSuccess(true);
      } else {
        setTotalFinesCharged(totalFines);
        setSuccess(true);
      }
    });
  }

  // หัวข้อแต่ละ step
  const stepTitle =
    step === 1 ? "คืนหนังสือ (1/3)" : step === 2 ? "คืนหนังสือ (2/3)" : "คืนหนังสือ (3/3)";

  return (
    <Modal open={open} onClose={handleClose} title={stepTitle} size="xl">
      {success ? (
        /* ---------- หน้าจอสำเร็จ ---------- */
        <div className="space-y-4 text-center py-8">
          <div className="w-16 h-16 rounded-full bg-meb-light flex items-center justify-center mx-auto">
            <PhosphorIcon name="check-circle" weight="fill" className="text-4xl text-meb-green" />
          </div>
          <h3 className="text-lg font-bold text-forest dark:text-slate-100">
            คืนหนังสือสำเร็จ
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            บันทึกการคืน {returnItems.length} เล่ม เรียบร้อยแล้ว
          </p>
          {totalFinesCharged > 0 && (
            <p className="text-sm font-bold text-price-red">
              ค่าปรับรวมที่เรียกเก็บ: ฿{totalFinesCharged.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </p>
          )}
          {confirmError && (
            <p className="text-sm text-amber-600 dark:text-amber-400">{confirmError}</p>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-2.5 rounded-md text-sm transition"
          >
            ปิด
          </button>
        </div>
      ) : step === 1 ? (
        /* ---------- Step 1: ค้นหา/เลือกสมาชิก ---------- */
        <div className="space-y-4">
          <form onSubmit={handleSearchMember} className="flex gap-2">
            <div className="relative flex-1">
              <PhosphorIcon
                name="magnifying-glass"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
              />
              <input
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="ค้นหาชื่อหรือรหัสสมาชิก..."
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={memberSearching || !memberQuery.trim()}
              className="inline-flex items-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {memberSearching ? (
                <PhosphorIcon name="circle-notch" className="animate-spin" />
              ) : (
                <PhosphorIcon name="magnifying-glass" />
              )}
              ค้นหา
            </button>
          </form>

          {memberError && (
            <div className="flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 p-3 rounded-lg text-sm">
              <PhosphorIcon name="warning" weight="fill" />
              {memberError}
            </div>
          )}

          {memberResults.length > 0 && (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {memberResults.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectMember(m)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-border-base hover:bg-meb-light/50 dark:hover:bg-white/5 transition text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-meb-light text-meb-green flex items-center justify-center text-sm font-bold shrink-0">
                      {getInitials(m.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-forest dark:text-slate-100 truncate">
                        {m.full_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {m.user_id_code} · {m.role === "member" ? "สมาชิก" : m.role === "staff" ? "เจ้าหน้าที่" : "ผู้ดูแล"}
                      </p>
                    </div>
                    <PhosphorIcon name="caret-right" className="text-slate-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {memberResults.length === 0 && !memberSearching && !memberError && memberQuery.trim() && (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
              กดค้นหาเพื่อหาสมาชิก
            </div>
          )}
        </div>
      ) : step === 2 ? (
        /* ---------- Step 2: เลือกหนังสือที่จะคืน ---------- */
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-meb-green transition"
          >
            <PhosphorIcon name="arrow-left" />
            ย้อนกลับ
          </button>

          {/* การ์ดสมาชิกที่เลือก */}
          {selectedMember && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-meb-light/50 dark:bg-meb-green/10">
              <div className="w-10 h-10 rounded-full bg-meb-light text-meb-green flex items-center justify-center text-sm font-bold shrink-0">
                {getInitials(selectedMember.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-forest dark:text-slate-100 truncate">
                  {selectedMember.full_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedMember.user_id_code}
                </p>
              </div>
            </div>
          )}

          {/* ช่องสแกนบาร์โค้ด */}
          <form onSubmit={handleScanBarcode} className="flex gap-2">
            <div className="relative flex-1">
              <PhosphorIcon
                name="barcode"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
              />
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="สแกนบาร์โค้ดหนังสือที่จะคืน..."
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!barcodeInput.trim()}
              className="inline-flex items-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PhosphorIcon name="check" weight="bold" />
              เลือก
            </button>
          </form>

          {scanError && (
            <div className="flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 p-2.5 rounded-lg text-sm">
              <PhosphorIcon name="warning" weight="fill" />
              {scanError}
            </div>
          )}

          {/* รายการยืมปัจจุบัน */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-forest dark:text-slate-100">
              รายการยืมปัจจุบัน ({activeBorrows.length})
            </h3>

            {loadingBorrows ? (
              <div className="flex items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                <PhosphorIcon name="circle-notch" className="text-2xl animate-spin mr-2" />
                <span className="text-sm">กำลังโหลด...</span>
              </div>
            ) : activeBorrows.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                สมาชิกไม่มีรายการยืมอยู่
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {activeBorrows.map((r) => {
                  const selected = isSelected(r.id);
                  const days = daysOverdue(r.due_date);
                  const isOverdue = r.status === "overdue" || days > 0;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() =>
                          selected
                            ? removeReturnItem(r.id)
                            : addReturnItem(r)
                        }
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition text-left ${
                          selected
                            ? "border-meb-green bg-meb-light/50 dark:bg-meb-green/10"
                            : "border-gray-100 dark:border-border-base hover:bg-meb-light/30 dark:hover:bg-white/5"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                            selected
                              ? "bg-meb-green border-meb-green"
                              : "border-gray-300 dark:border-border-base"
                          }`}
                        >
                          {selected && (
                            <PhosphorIcon name="check" weight="bold" className="text-white text-xs" />
                          )}
                        </div>
                        {r.book_copy?.book?.cover_image_url ? (
                          <img
                            src={r.book_copy.book.cover_image_url}
                            alt={r.book_copy.book.title}
                            width={28}
                            height={40}
                            className="w-7 h-10 object-cover rounded bg-gray-100 dark:bg-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-10 rounded bg-meb-light flex items-center justify-center text-meb-green shrink-0">
                            <PhosphorIcon name="book" className="text-xs" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-forest dark:text-slate-100 truncate text-sm">
                            {r.book_copy?.book?.title ?? "-"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {r.book_copy?.barcode ?? "-"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            กำหนดคืน {formatDate(r.due_date)}
                          </p>
                          {isOverdue && (
                            <p className="text-xs text-price-red font-bold">
                              เกิน {Math.abs(days)} วัน
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* รายการที่เลือกเพื่อคืน */}
          {returnItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-forest dark:text-slate-100">
                จะคืน ({returnItems.length} เล่ม)
              </h3>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {returnItems.map((item) => (
                  <li
                    key={item.record.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-meb-green/30 bg-meb-light/30 dark:bg-meb-green/5 text-sm"
                  >
                    <PhosphorIcon name="book" className="text-meb-green shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-forest dark:text-slate-100 truncate font-medium">
                        {item.record.book_copy?.book?.title ?? "-"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {item.record.book_copy?.barcode ?? "-"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReturnItem(item.record.id)}
                      className="shrink-0 p-1 rounded text-slate-400 hover:text-price-red hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                      aria-label="ลบ"
                    >
                      <PhosphorIcon name="x" className="text-sm" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {returnItems.length > 0 && (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition"
            >
              ถัดไป: คำนวณค่าปรับ
              <PhosphorIcon name="arrow-right" />
            </button>
          )}
        </div>
      ) : (
        /* ---------- Step 3: คำนวณค่าปรับ + ยืนยัน ---------- */
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-meb-green transition"
          >
            <PhosphorIcon name="arrow-left" />
            ย้อนกลับ
          </button>

          <h3 className="text-sm font-bold text-forest dark:text-slate-100">
            รายการคืน ({returnItems.length} เล่ม)
          </h3>

          {/* รายการคืนพร้อมฟอร์มค่าปรับ */}
          <ul className="space-y-3 max-h-80 overflow-y-auto">
            {returnItems.map((item) => {
              const days = daysOverdue(item.record.due_date);
              const isOverdue = item.record.status === "overdue" || days > 0;
              return (
                <li
                  key={item.record.id}
                  className="p-3 rounded-lg border border-gray-100 dark:border-border-base space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    {item.record.book_copy?.book?.cover_image_url ? (
                      <img
                        src={item.record.book_copy.book.cover_image_url}
                        alt={item.record.book_copy.book.title}
                        width={28}
                        height={40}
                        className="w-7 h-10 object-cover rounded bg-gray-100 dark:bg-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-10 rounded bg-meb-light flex items-center justify-center text-meb-green shrink-0">
                        <PhosphorIcon name="book" className="text-xs" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-forest dark:text-slate-100 truncate text-sm">
                        {item.record.book_copy?.book?.title ?? "-"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {item.record.book_copy?.barcode ?? "-"}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                    <span>ยืม: {formatDate(item.record.borrowed_at)}</span>
                    <span>ครบกำหนด: {formatDate(item.record.due_date)}</span>
                    {isOverdue && (
                      <span className="text-price-red font-bold">
                        เกิน {Math.abs(days)} วัน (แนะนำ ฿{(Math.abs(days) * FINE_PER_DAY).toLocaleString()})
                      </span>
                    )}
                  </div>

                  {/* ฟอร์มค่าปรับ */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                        ค่าปรับ (บาท)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.fineAmount}
                        onChange={(e) =>
                          updateFineAmount(item.record.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded outline-none focus:border-meb-green text-forest dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                        เหตุผลค่าปรับ
                      </label>
                      <select
                        value={item.fineReason}
                        onChange={(e) =>
                          updateFineReason(
                            item.record.id,
                            e.target.value as ReturnItem["fineReason"],
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
                        value={item.remark}
                        onChange={(e) => updateRemark(item.record.id, e.target.value)}
                        placeholder="หมายเหตุเพิ่มเติม..."
                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded outline-none focus:border-meb-green text-forest dark:text-slate-100"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {confirmError && (
            <div className="flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 p-3 rounded-lg text-sm">
              <PhosphorIcon name="warning" weight="fill" />
              {confirmError}
            </div>
          )}

          {progress && (
            <div className="text-center text-sm text-slate-500 dark:text-slate-400">
              กำลังบันทึก... {progress.done}/{progress.total}
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? (
              <>
                <PhosphorIcon name="circle-notch" className="animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <PhosphorIcon name="check" weight="bold" />
                ยืนยันการคืน
              </>
            )}
          </button>
        </div>
      )}
    </Modal>
  );
}