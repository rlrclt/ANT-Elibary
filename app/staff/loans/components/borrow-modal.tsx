"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Modal } from "../../../components/modal";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  searchMemberAction,
  searchByBarcodeAction,
  borrowBookAction,
  getMemberActiveBorrowsAction,
} from "../actions";

/**
 * borrow-modal — ฟอร์มยืมหนังสือแบบหลายขั้นตอน
 * Step 1: ค้นหา/เลือกสมาชิก
 * Step 2: เพิ่มหนังสือเข้าตะกร้ายืม (สแกนบาร์โค้ดเป็นหลัก)
 * Step 3: ยืนยันการยืม → โชว์สรุป → เรียก borrowBookAction ทีละเล่ม
 */
type BorrowModalProps = {
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

// รายการในตะกร้ายืม
type CartItem = {
  book_copy_id: string;
  barcode: string;
  book_title: string;
  book_code: string;
  cover_image_url: string | null;
  due_date: string; // ISO date (yyyy-mm-dd)
};

// คำนวณวันคืนเริ่มต้น = วันนี้ + 14 วัน
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

// format วันที่ dd/MM/yyyy (ไม่ใช้ toLocaleDateString เพื่อป้องกัน hydration mismatch)
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ดึง 2 ตัวอักษรแรกของชื่อ
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function BorrowModal({ open, onClose }: BorrowModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [success, setSuccess] = useState(false);

  // Step 1 — search member
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<SelectedMember[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
  const [currentBorrowCount, setCurrentBorrowCount] = useState<number>(0);
  const [borrowLimit, setBorrowLimit] = useState<number>(5);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Step 2 — cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanToast, setScanToast] = useState<string | null>(null);
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
      setMemberQuery("");
      setMemberResults([]);
      setSelectedMember(null);
      setCurrentBorrowCount(0);
      setBorrowLimit(5);
      setMemberError(null);
      setCart([]);
      setBarcodeInput("");
      setScanError(null);
      setScanToast(null);
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

  // เลือกสมาชิก → ดึงจำนวนยืมปัจจุบัน + borrow_limit
  async function handleSelectMember(m: SelectedMember) {
    setSelectedMember(m);
    setMemberError(null);
    // ดึงจำนวนยืมปัจจุบันของสมาชิก
    const borrowsRes = await getMemberActiveBorrowsAction(m.id);
    setCurrentBorrowCount(borrowsRes.data?.length ?? 0);
    // borrow_limit ใช้ค่าเริ่มต้น 5 (ข้อมูล limit ไม่ได้ส่งกลับใน searchMemberAction)
    // หากต้องการค่าจริง ให้ดึงเพิ่มจากหน้า drawer
    setBorrowLimit(5);
    setStep(2);
  }

  // สแกนบาร์โค้ด → เพิ่มเข้าตะกร้า
  async function handleScanBarcode(e: React.FormEvent) {
    e.preventDefault();
    const b = barcodeInput.trim();
    if (!b) return;
    setScanError(null);
    setScanToast(null);

    // ตรวจซ้ำในตะกร้า
    if (cart.some((c) => c.barcode === b)) {
      setScanError("เล่มนี้อยู่ในตะกร้าแล้ว");
      setBarcodeInput("");
      return;
    }

    // ตรวจเกินจำกัดการยืม
    if (currentBorrowCount + cart.length >= borrowLimit) {
      setScanError(`สมาชิกยืมครบจำนวนจำกัดแล้ว (${borrowLimit} เล่ม)`);
      setBarcodeInput("");
      return;
    }

    const res = await searchByBarcodeAction(b);
    if (res.error || !res.data) {
      setScanError(res.error ?? "ไม่พบเล่มหนังสือ");
      setBarcodeInput("");
      return;
    }

    if (res.data.status !== "available") {
      setScanError(`เล่มนี้ไม่พร้อมยืม (สถานะ: ${res.data.status})`);
      setBarcodeInput("");
      return;
    }

    const newItem: CartItem = {
      book_copy_id: res.data.book_copy_id,
      barcode: res.data.barcode,
      book_title: res.data.book_title,
      book_code: res.data.book_code,
      cover_image_url: res.data.cover_image_url,
      due_date: defaultDueDate(),
    };
    setCart([...cart, newItem]);
    setScanToast(`เพิ่มแล้ว: ${res.data.book_title}`);
    setBarcodeInput("");
    setTimeout(() => setScanToast(null), 2000);
  }

  // ลบรายการออกจากตะกร้า
  function removeFromCart(barcode: string) {
    setCart(cart.filter((c) => c.barcode !== barcode));
  }

  // แก้วันคืนของรายการในตะกร้า
  function updateDueDate(barcode: string, newDate: string) {
    setCart(cart.map((c) => (c.barcode === barcode ? { ...c, due_date: newDate } : c)));
  }

  // ยืนยันการยืม → เรียก borrowBookAction ทีละเล่ม
  function handleConfirm() {
    if (!selectedMember || cart.length === 0) return;
    setConfirmError(null);
    setProgress({ done: 0, total: cart.length });

    startTransition(async () => {
      let failed = 0;
      let lastErr = "";
      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const formData = new FormData();
        formData.set("user_id", selectedMember.id);
        formData.set("barcode", item.barcode);
        formData.set("due_date", new Date(item.due_date).toISOString());
        const res = await borrowBookAction(formData);
        if (res.error) {
          failed++;
          lastErr = res.error;
        }
        setProgress({ done: i + 1, total: cart.length });
      }
      if (failed === cart.length) {
        // ล้มเหลวทั้งหมด
        setConfirmError(lastErr);
        setProgress(null);
      } else if (failed > 0) {
        // สำเร็จบางส่วน
        setConfirmError(`ยืมสำเร็จ ${cart.length - failed} เล่ม ล้มเหลว ${failed} เล่ม (${lastErr})`);
        setSuccess(true);
      } else {
        setSuccess(true);
      }
    });
  }

  // หัวข้อแต่ละ step
  const stepTitle =
    step === 1 ? "ยืมหนังสือ (1/3)" : step === 2 ? "ยืมหนังสือ (2/3)" : "ยืมหนังสือ (3/3)";

  return (
    <Modal open={open} onClose={handleClose} title={stepTitle} size="xl">
      {success ? (
        /* ---------- หน้าจอสำเร็จ ---------- */
        <div className="space-y-4 text-center py-8">
          <div className="w-16 h-16 rounded-full bg-meb-light flex items-center justify-center mx-auto">
            <PhosphorIcon name="check-circle" weight="fill" className="text-4xl text-meb-green" />
          </div>
          <h3 className="text-lg font-bold text-forest dark:text-slate-100">
            ยืมหนังสือสำเร็จ
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            บันทึกการยืม {cart.length} เล่ม ให้ {selectedMember?.full_name} เรียบร้อยแล้ว
          </p>
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

          {/* รายการผลลัพธ์ */}
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
        /* ---------- Step 2: เพิ่มหนังสือเข้าตะกร้า ---------- */
        <div className="space-y-4">
          {/* ปุ่มย้อนกลับ */}
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
                  {selectedMember.user_id_code} · ยืมปัจจุบัน {currentBorrowCount}/{borrowLimit} เล่ม
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
                placeholder="สแกนบาร์โค้ดหนังสือ..."
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!barcodeInput.trim()}
              className="inline-flex items-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PhosphorIcon name="plus" weight="bold" />
              เพิ่ม
            </button>
          </form>

          {/* TODO: ตัวเลือกเลือกจากรายการ (book picker) — ยังไม่ได้พัฒนา ใช้สแกนบาร์โค้ดเป็นหลัก */}

          {scanToast && (
            <div className="flex items-center gap-2 text-meb-green bg-meb-light/50 dark:bg-meb-green/10 p-2.5 rounded-lg text-sm">
              <PhosphorIcon name="check-circle" weight="fill" />
              {scanToast}
            </div>
          )}

          {scanError && (
            <div className="flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 p-2.5 rounded-lg text-sm">
              <PhosphorIcon name="warning" weight="fill" />
              {scanError}
            </div>
          )}

          {/* รายการในตะกร้า */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-forest dark:text-slate-100">
                ตะกร้ายืม ({cart.length})
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-slate-500 hover:text-price-red transition"
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                ยังไม่มีหนังสือในตะกร้า สแกนบาร์โค้ดเพื่อเพิ่ม
              </div>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <li
                    key={item.barcode}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-border-base"
                  >
                    {item.cover_image_url ? (
                      <img
                        src={item.cover_image_url}
                        alt={item.book_title}
                        width={32}
                        height={44}
                        className="w-8 h-11 object-cover rounded bg-gray-100 dark:bg-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-11 rounded bg-meb-light flex items-center justify-center text-meb-green shrink-0">
                        <PhosphorIcon name="book" className="text-sm" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-forest dark:text-slate-100 truncate text-sm">
                        {item.book_title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {item.barcode}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                        กำหนดคืน
                      </label>
                      <input
                        type="date"
                        value={item.due_date}
                        onChange={(e) => updateDueDate(item.barcode, e.target.value)}
                        className="px-2 py-1 text-xs bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded outline-none focus:border-meb-green text-forest dark:text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.barcode)}
                      className="shrink-0 p-1.5 rounded text-slate-400 hover:text-price-red hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                      aria-label="ลบ"
                    >
                      <PhosphorIcon name="trash" className="text-base" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ปุ่มถัดไป */}
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition"
            >
              ถัดไป: ยืนยันการยืม
              <PhosphorIcon name="arrow-right" />
            </button>
          )}
        </div>
      ) : (
        /* ---------- Step 3: ยืนยัน ---------- */
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-meb-green transition"
          >
            <PhosphorIcon name="arrow-left" />
            ย้อนกลับ
          </button>

          {/* สรุปสมาชิก */}
          {selectedMember && (
            <div className="p-3 rounded-lg bg-meb-light/50 dark:bg-meb-green/10">
              <p className="text-xs text-slate-500 dark:text-slate-400">สมาชิก</p>
              <p className="font-bold text-forest dark:text-slate-100">
                {selectedMember.full_name} ({selectedMember.user_id_code})
              </p>
            </div>
          )}

          {/* สรุปรายการหนังสือ */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-forest dark:text-slate-100">
              รายการยืม ({cart.length} เล่ม)
            </h3>
            <ul className="space-y-1.5 max-h-56 overflow-y-auto">
              {cart.map((item) => (
                <li
                  key={item.barcode}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-border-base text-sm"
                >
                  <PhosphorIcon name="book" className="text-meb-green shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-forest dark:text-slate-100 truncate font-medium">
                      {item.book_title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {item.barcode}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    คืน {formatDate(item.due_date)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

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
                  ยืนยันการยืม
                </>
              )}
          </button>
        </div>
      )}
    </Modal>
  );
}