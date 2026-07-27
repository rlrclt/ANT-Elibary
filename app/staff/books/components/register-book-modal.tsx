"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "../../../components/modal";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { TextField, SubmitButton } from "../../../components/form-controls";
import {
  generateBookCodeAction,
  registerBookAction,
  type Category,
} from "../actions";

/**
 * register-book-modal — ฟอร์มเพิ่มหนังสือใหม่
 * - เปิด modal → generateBookCodeAction เพื่อ prefill book_code (readonly)
 * - ส่งฟอร์ม → registerBookAction → โชว์ barcodes + ปุ่มพิมพ์
 */
type RegisterBookModalProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
};

export function RegisterBookModal({ open, onClose, categories }: RegisterBookModalProps) {
  const [bookCode, setBookCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [barcodes, setBarcodes] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  // เมื่อเปิด modal → ขอ book_code อัตโนมัติ
  useEffect(() => {
    if (!open) return;
    setBookCode("");
    setError(null);
    setBarcodes(null);
    generateBookCodeAction().then((res) => {
      if (res.data) setBookCode(res.data);
      else if (res.error) setError(res.error);
    });
  }, [open]);

  // submit ฟอร์ม → เรียก registerBookAction
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registerBookAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.barcodes) setBarcodes(res.barcodes);
    });
  }

  // ปุ่มพิมพ์บาร์โค้ด — ยังไม่ต่อ wire (console.log ไว้ก่อน)
  function handlePrint() {
    console.log("[register-book] print barcodes:", barcodes);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="เพิ่มหนังสือใหม่"
      description="กรอกข้อมูลหนังสือและจำนวนเล่มตั้งต้น"
      size="lg"
    >
      {/* สถานะสำเร็จ → โชว์รายการ barcodes */}
      {barcodes ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-meb-green bg-meb-light/50 dark:bg-meb-green/10 p-3 rounded-lg">
            <PhosphorIcon name="check-circle" weight="fill" className="text-xl" />
            <p className="text-sm font-medium">
              สร้างหนังสือสำเร็จ ได้เล่มลูก {barcodes.length} เล่ม
            </p>
          </div>
          <ul className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 dark:border-border-base divide-y divide-gray-50 dark:divide-border-base">
            {barcodes.map((b) => (
              <li
                key={b}
                className="px-3 py-2 font-mono text-sm text-forest dark:text-slate-100"
              >
                {b}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition"
            >
              <PhosphorIcon name="printer" />
              พิมพ์บาร์โค้ด
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-forest dark:text-slate-100 font-bold px-4 py-2.5 rounded-md text-sm transition"
            >
              ปิด
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* แจ้งเตือน error */}
          {error && (
            <div className="flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 p-3 rounded-lg text-sm">
              <PhosphorIcon name="warning" weight="fill" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {/* book_code — readonly */}
            <div>
              <label
                htmlFor="book_code"
                className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
              >
                รหัสหนังสือ
              </label>
              <input
                id="book_code"
                name="book_code"
                value={bookCode}
                readOnly
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-border-base rounded-md font-mono text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            {/* หมวดหมู่ — native select */}
            <div>
              <label
                htmlFor="category_id"
                className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
              >
                หมวดหมู่
              </label>
              <select
                id="category_id"
                name="category_id"
                defaultValue=""
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              >
                <option value="">— เลือกหมวดหมู่ —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ชื่อหนังสือ (เต็ม 2 คอลัมน์) */}
            <div className="sm:col-span-2">
              <TextField
                label="ชื่อหนังสือ"
                name="title"
                required
                placeholder="เช่น สู่จุดจบของวิทยาศาสตร์"
                icon="book"
              />
            </div>

            <TextField
              label="ผู้แต่ง"
              name="author"
              placeholder="ชื่อผู้แต่ง"
              icon="user"
            />

            <TextField
              label="ISBN"
              name="isbn"
              placeholder="978-616-xxx-xxx-x"
              icon="barcode"
            />

            <TextField
              label="สำนักพิมพ์"
              name="publisher"
              placeholder="สำนักพิมพ์"
              icon="building-office"
            />

            <TextField
              label="ชั้นวาง"
              name="shelf_location"
              placeholder="เช่น A1-02"
              icon="bookshelf"
              helper="รหัสชั้นวางหนังสือ"
            />

            <div className="sm:col-span-2">
              <TextField
                label="URL ภาพปก"
                name="cover_image_url"
                placeholder="https://..."
                icon="image"
              />
            </div>

            {/* จำนวนเล่มตั้งต้น */}
            <div className="sm:col-span-2">
              <label
                htmlFor="initial_copies"
                className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
              >
                จำนวนเล่มตั้งต้นที่นำเข้า
              </label>
              <div className="relative">
                <PhosphorIcon
                  name="stack"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
                />
                <input
                  id="initial_copies"
                  name="initial_copies"
                  type="number"
                  min={1}
                  defaultValue={1}
                  placeholder="1"
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                ระบบจะสร้างรหัสบาร์โค้ดเล่มลูกให้อัตโนมัติเท่าจำนวนนี้ (เช่น BK-2026-001-01)
              </p>
            </div>
          </div>

          <div className="pt-2">
            <SubmitButton loading={pending}>
              <PhosphorIcon name="plus" weight="bold" />
              บันทึกหนังสือ
            </SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  );
}