"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { Modal } from "../../../components/modal";
import {
  smartScanAction,
  memberBorrowAction,
  memberReturnAction,
  uploadReturnPhotoAction,
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
 * ช่องสแกนบาร์โค้ดเดียว ระบบตัดสินใจเองว่าสแกนนั้นคือยืมหรือคืน (auto-detect):
 * - เล่มที่ยังว่าง (available) → ยืมทันที
 * - เล่มที่ผู้ใช้ยืมอยู่ (มีรายการค้าง) → เปิด modal คืน (ถ่ายรูป + เลือกสภาพ)
 * ออกแบบเหมือน kiosk: อินพุตใหญ่, กด Enter เพื่อส่ง, แสดงผลทันที
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
  // --- ช่องสแกนกลาง (ยืม/คืนอัตโนมัติ) ---
  const [barcode, setBarcode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanToast, setScanToast] = useState<{
    type: "success" | "error";
    message: string;
    fineAmount?: number;
  } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // --- คำขอกลืนคืน (ถ่ายรูป + เลือกสภาพ) ---
  const [returnTarget, setReturnTarget] = useState<{
    mode: "barcode" | "record";
    value: string;
    bookTitle: string;
  } | null>(null);
  const [returnCondition, setReturnCondition] = useState<
    "normal" | "slight_damage" | "damaged" | ""
  >("");
  const [returnPhoto, setReturnPhoto] = useState<File | null>(null);
  const [returnPhotoPreview, setReturnPhotoPreview] = useState<string | null>(null);
  const [returnUploading, setReturnUploading] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // โฟกัสช่องสแกนเมื่อ mount
  useEffect(() => {
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, []);

  // เคลียร์ toast อัตโนมัติ
  useEffect(() => {
    if (scanToast) {
      const t = setTimeout(() => setScanToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [scanToast]);

  // --- สแกนบาร์โค้ด → ระบบตัดสินใจว่ายืมหรือคืน ---
  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const b = barcode.trim();
    if (!b || scanLoading) return;

    setScanLoading(true);
    setScanToast(null);

    try {
      const scanRes = await smartScanAction(b);

      // error จากการสแกน
      if (scanRes.error) {
        setScanToast({ type: "error", message: scanRes.error });
        setBarcode("");
        return;
      }

      // --- สแกนนี้คือ "ยืม" → ยืมทันที ---
      if (scanRes.intent === "borrow") {
        const formData = new FormData();
        formData.set("barcode", b);
        const res = await memberBorrowAction(formData);
        if (res.error) {
          setScanToast({ type: "error", message: res.error });
        } else {
          setScanToast({
            type: "success",
            message: `ยืมสำเร็จ: ${res.bookTitle ?? scanRes.bookTitle ?? "หนังสือ"}`,
          });
          setBarcode("");
          startTransition(() => {
            onBorrowed();
          });
        }
        return;
      }

      // --- สแกนนี้คือ "คืน" → เปิด modal ถ่ายรูป/เลือกสภาพ ---
      if (scanRes.recordId) {
        setReturnTarget({
          mode: "record",
          value: scanRes.recordId,
          bookTitle: scanRes.bookTitle ?? "หนังสือ",
        });
        setReturnCondition("");
        setReturnPhoto(null);
        setReturnPhotoPreview(null);
        setReturnError(null);
        setBarcode("");
        return;
      }

      // ไม่ควรถึงตรงนี้
      setScanToast({ type: "error", message: "ไม่สามารถระบุรายการยืมได้" });
    } catch {
      setScanToast({ type: "error", message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setScanLoading(false);
    }
  }

  // --- กดปุ่มคืนในรายการ → เปิด modal ถ่ายรูป/เลือกสภาพ ---
  function openReturnByRecord(record: MemberBorrowRecord) {
    setReturnTarget({
      mode: "record",
      value: record.id,
      bookTitle: record.book_copy?.book?.title ?? "ไม่ระบุชื่อ",
    });
    setReturnCondition("");
    setReturnPhoto(null);
    setReturnPhotoPreview(null);
    setReturnError(null);
  }

  // --- เลือกรูปถ่าย ---
  function handleReturnPhotoSelect(file: File | null) {
    setReturnPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setReturnPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setReturnPhotoPreview(null);
    }
  }

  // --- ยืนยันคำขอกลืนคืน (อัปโหลดรูป + ส่งคำขอ) ---
  async function confirmReturnRequest() {
    if (!returnTarget) return;
    if (!returnCondition) {
      setReturnError("กรุณาเลือกสภาพหนังสือ");
      return;
    }
    if (!returnPhoto) {
      setReturnError("กรุณาถ่ายรูปหรือเลือกไฟล์ภาพหนังสือ");
      return;
    }

    setReturnLoading(true);
    setReturnError(null);

    try {
      // 1. อัปโหลดรูปถ่าย
      setReturnUploading(true);
      const uploadForm = new FormData();
      uploadForm.set("photo", returnPhoto);
      const uploadRes = await uploadReturnPhotoAction(uploadForm);
      setReturnUploading(false);

      if (uploadRes.error || !uploadRes.url) {
        setReturnError(uploadRes.error ?? "อัปโหลดรูปไม่สำเร็จ");
        return;
      }

      // 2. ส่งคำขอกลืนคืน
      const formData = new FormData();
      formData.set(returnTarget.mode === "barcode" ? "barcode" : "record_id", returnTarget.value);
      formData.set("return_condition", returnCondition);
      formData.set("return_photo_url", uploadRes.url);

      const res = await memberReturnAction(formData);
      if (res.error) {
        setReturnError(res.error);
      } else {
        setScanToast({
          type: "success",
          message: `ส่งคำขอกลืนคืน: ${res.bookTitle ?? returnTarget.bookTitle} — รอเจ้าหน้าที่ตรวจสอบ`,
          fineAmount: res.fineAmount,
        });
        setReturnTarget(null);
        setBarcode("");
        startTransition(() => {
          onReturned();
        });
      }
    } catch {
      setReturnError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setReturnUploading(false);
      setReturnLoading(false);
    }
  }

  // ตรวจ overdue สำหรับรายการ active
  function isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
  }

  return (
    <div className="space-y-4">
      {/* ====== แผงสแกนเดียว (ยืม/คืนอัตโนมัติ) ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อ */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-lg bg-meb-light dark:bg-meb-green/15 flex items-center justify-center text-meb-green text-xl shrink-0">
            <PhosphorIcon name="barcode" weight="fill" />
          </div>
          <div>
            <h2 className="text-base font-bold text-forest dark:text-slate-100">
              สแกนบาร์โค้ดหนังสือ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ระบบตรวจจับอัตโนมัติ — เล่มว่าง = ยืม, เล่มที่ค้างยืมอยู่ = คืน
            </p>
          </div>
        </div>

        {/* ช่องสแกนบาร์โค้ด — ใหญ่, กด Enter ได้เลย */}
        <form onSubmit={handleScan} className="space-y-3">
          <div className="relative">
            <PhosphorIcon
              name="barcode"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-2xl pointer-events-none"
            />
            <input
              ref={scanInputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="สแกนบาร์โค้ดหนังสือ..."
              disabled={scanLoading}
              className="w-full pl-14 pr-4 py-4 text-base bg-gray-50 dark:bg-black/30 border-2 border-gray-200 dark:border-border-base rounded-xl outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 font-mono placeholder:text-slate-400 disabled:opacity-60"
            />
          </div>

          {/* ปุ่มสแกน */}
          <button
            type="submit"
            disabled={scanLoading || !barcode.trim()}
            className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-3.5 rounded-xl text-base shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {scanLoading ? (
              <>
                <PhosphorIcon name="circle-notch" className="animate-spin text-lg" />
                กำลังตรวจสอบ...
              </>
            ) : (
              <>
                <PhosphorIcon name="barcode" weight="bold" className="text-lg" />
                สแกน / ยืนยัน
              </>
            )}
          </button>
        </form>

        {/* Toast ผลลัพธ์ */}
        {scanToast && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm font-medium space-y-1 ${
              scanToast.type === "success"
                ? "bg-meb-light/50 dark:bg-meb-green/10 text-meb-green"
                : "bg-red-50 dark:bg-red-500/10 text-price-red"
            }`}
          >
            <div className="flex items-center gap-2">
              <PhosphorIcon
                name={scanToast.type === "success" ? "check-circle" : "warning-circle"}
                weight="fill"
                className="text-lg shrink-0"
              />
              <span>{scanToast.message}</span>
            </div>
            {scanToast.type === "success" && scanToast.fineAmount && scanToast.fineAmount > 0 && (
              <div className="flex items-center gap-2 pl-7 text-price-red font-bold">
                <PhosphorIcon name="currency-dollar" weight="fill" className="text-sm" />
                ค่าปรับกรณีคืนช้า: ฿{scanToast.fineAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
            )}
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
            สแกนบาร์โค้ดแล้วกด Enter — ระบบแยกยืม/คืนให้อัตโนมัติ
          </div>
        </div>
      </section>

      {/* ====== รายการยืมปัจจุบัน — กดปุ่มคืนได้ ====== */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 text-xl shrink-0">
            <PhosphorIcon name="arrow-u-up-left" weight="fill" />
          </div>
          <div>
            <h2 className="text-base font-bold text-forest dark:text-slate-100">
              คืนหนังสือ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              สแกนบาร์โค้ดเล่มที่ค้างยืม หรือกดปุ่มคืนในรายการ
            </p>
          </div>
        </div>

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
                  {record.status === "pending_return" ? (
                    <span className="shrink-0 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-md">
                      รอตรวจสอบ
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openReturnByRecord(record)}
                      disabled={returnLoading}
                      className="shrink-0 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-md transition disabled:opacity-60"
                    >
                      คืน
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ====== Modal ส่งคำขอกลืนคืน (ถ่ายรูป + เลือกสภาพ) ====== */}
      <Modal
        open={returnTarget !== null}
        onClose={() => setReturnTarget(null)}
        title="ส่งคำขอกลืนคืน"
        description={returnTarget?.bookTitle ?? "หนังสือ"}
        size="md"
      >
        {returnTarget && (
          <div className="space-y-5">
            {/* คำอธิบายขั้นตอน */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <PhosphorIcon name="info" weight="fill" className="text-blue-500 text-sm" />
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  ขั้นตอนการคืนหนังสือ
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                ถ่ายรูปหนังสือและเลือกสภาพ จากนั้นส่งคำขอคืน เจ้าหน้าที่จะตรวจสอบภายใน 7 วัน และแจ้งผลให้คุณทราบทาง LINE
              </p>
            </div>

            {/* ถ่ายรูปหนังสือ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                รูปถ่ายหนังสือ <span className="text-price-red">*</span>
              </label>
              <div className="flex items-start gap-3">
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-dashed border-gray-300 dark:border-border-base bg-gray-50 dark:bg-black/20 flex items-center justify-center shrink-0">
                  {returnPhotoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={returnPhotoPreview} alt="รูปถ่ายหนังสือ" className="w-full h-full object-cover" />
                  ) : (
                    <PhosphorIcon name="camera" className="text-2xl text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-meb-green bg-meb-light dark:bg-meb-green/10 hover:bg-meb-light/80 dark:hover:bg-meb-green/20 rounded-md cursor-pointer transition">
                    <PhosphorIcon name="camera-plus" />
                    {returnPhotoPreview ? "เปลี่ยนรูป" : "เลือก / ถ่ายรูป"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleReturnPhotoSelect(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {returnPhoto && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                      {returnPhoto.name} ({(returnPhoto.size / (1024 * 1024)).toFixed(1)} MB)
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    JPEG / PNG / WEBP ไม่เกิน 5MB
                  </p>
                </div>
              </div>
            </div>

            {/* เลือกสภาพหนังสือ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                สภาพหนังสือ <span className="text-price-red">*</span>
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
                    onClick={() => setReturnCondition(opt.value)}
                    className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-bold transition ${
                      returnCondition === opt.value
                        ? "border-meb-green bg-meb-light/60 dark:bg-meb-green/10 text-meb-green"
                        : "border-gray-200 dark:border-border-base text-slate-500 dark:text-slate-400 hover:border-meb-green/40"
                    }`}
                  >
                    <PhosphorIcon
                      name={opt.icon}
                      weight="fill"
                      className={returnCondition === opt.value ? "text-meb-green" : "text-slate-300 dark:text-slate-600"}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* แสดง error ถ้ามี */}
            {returnError && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2.5 text-xs font-medium text-price-red">
                <PhosphorIcon name="warning-circle" weight="fill" className="shrink-0" />
                {returnError}
              </div>
            )}

            {/* ปุ่มยืนยัน */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={confirmReturnRequest}
                disabled={returnLoading || returnUploading}
                className="btn-cta flex-1 inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-3 rounded-md text-sm shadow-sm disabled:opacity-60"
              >
                {returnLoading || returnUploading ? (
                  <>
                    <PhosphorIcon name="circle-notch" className="animate-spin" />
                    {returnUploading ? "กำลังอัปโหลดรูป..." : "กำลังส่งคำขอ..."}
                  </>
                ) : (
                  <>
                    <PhosphorIcon name="check-circle" weight="fill" />
                    ส่งคำขอกลืนคืน
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                disabled={returnLoading || returnUploading}
                className="px-5 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition disabled:opacity-60"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
