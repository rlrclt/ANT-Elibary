"use client";

import { useState, useTransition } from "react";
import { Modal } from "../../../components/modal";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { SubmitButton } from "../../../components/form-controls";
import {
  searchBookByIsbnAction,
  addBookCopiesByIsbnAction,
} from "../actions";

/**
 * add-copy-by-isbn-modal — เพิ่มเล่มลูกจาก ISBN/รหัสหนังสือ
 * Step 1: ค้นหา → โชว์ผลลัพธ์ → ถัดไป
 * Step 2: กรอก count/condition/price → submit → โชว้ barcodes
 */
type AddCopyByIsbnModalProps = {
  open: boolean;
  onClose: () => void;
};

// ผลลัพธ์การค้นหา (subset ของ BookWithCategory ที่ action ส่งกลับ)
type SearchResult = {
  id: string;
  book_code: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_image_url: string | null;
  total_copies: number;
  available_copies: number;
};

// แมป label สภาพเล่ม
const CONDITION_LABEL: Record<string, string> = {
  new: "ใหม่",
  good: "ดี",
  fair: "พอใช้",
  poor: "ชำรุด",
};

export function AddCopyByIsbnModal({ open, onClose }: AddCopyByIsbnModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [barcodes, setBarcodes] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  // reset เมื่อปิด modal
  function handleClose() {
    onClose();
    // reset หลัง animation ปิดเล็กน้อย
    setTimeout(() => {
      setStep(1);
      setQuery("");
      setResult(null);
      setSearchError(null);
      setSubmitError(null);
      setBarcodes(null);
    }, 100);
  }

  // ค้นหาหนังสือด้วย ISBN หรือ book_code
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setSearching(true);
    searchBookByIsbnAction(query)
      .then((res) => {
        if (res.error || !res.data) {
          setSearchError(res.error ?? "ไม่พบหนังสือ");
          setResult(null);
        } else {
          setResult(res.data as SearchResult);
        }
      })
      .finally(() => setSearching(false));
  }

  // submit ฟอร์มเพิ่มเล่มลูก
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    if (!result) return;
    const formData = new FormData(e.currentTarget);
    formData.set("book_id", result.id);
    startTransition(async () => {
      const res = await addBookCopiesByIsbnAction(formData);
      if (res.error) {
        setSubmitError(res.error);
        return;
      }
      if (res.barcodes) setBarcodes(res.barcodes);
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="เพิ่มเล่มลูกด้วย ISBN"
      description="ค้นหาหนังสือจาก ISBN หรือรหัส แล้วเพิ่มเล่มลูก"
      size="lg"
    >
      {/* สถานะสำเร็จ → โชว์ barcodes */}
      {barcodes ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-meb-green bg-meb-light/50 dark:bg-meb-green/10 p-3 rounded-lg">
            <PhosphorIcon name="check-circle" weight="fill" className="text-xl" />
            <p className="text-sm font-medium">
              เพิ่มเล่มลูกสำเร็จ {barcodes.length} เล่ม
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
          <button
            type="button"
            onClick={handleClose}
            className="w-full inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-forest dark:text-slate-100 font-bold px-4 py-2.5 rounded-md text-sm transition"
          >
            ปิด
          </button>
        </div>
      ) : step === 1 ? (
        /* ---------- Step 1: ค้นหา ---------- */
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ISBN หรือรหัสหนังสือ (เช่น BK-2026-001)"
              className="flex-1 pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="inline-flex items-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {searching ? (
                <PhosphorIcon name="circle-notch" className="animate-spin" />
              ) : (
                <PhosphorIcon name="magnifying-glass" />
              )}
              ค้นหา
            </button>
          </form>

          {searchError && (
            <div className="flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 p-3 rounded-lg text-sm">
              <PhosphorIcon name="warning" weight="fill" />
              {searchError}
            </div>
          )}

          {/* การ์ดผลลัพธ์ */}
          {result && (
            <div className="rounded-lg border border-gray-100 dark:border-border-base p-4 bg-gray-50 dark:bg-white/5">
              <div className="flex gap-3">
                {result.cover_image_url ? (
                  <img
                    src={result.cover_image_url}
                    alt={result.title}
                    className="w-16 h-22 object-cover rounded bg-gray-100 dark:bg-white/10"
                  />
                ) : (
                  <div className="w-16 h-22 rounded bg-meb-light flex items-center justify-center text-meb-green">
                    <PhosphorIcon name="book" className="text-2xl" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-meb-green">{result.book_code}</p>
                  <p className="font-bold text-forest dark:text-slate-100 truncate">
                    {result.title}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {result.author ?? "-"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    ปัจจุบันมี {result.total_copies} เล่ม (พร้อมยืม{" "}
                    {result.available_copies})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition"
              >
                ถัดไป
                <PhosphorIcon name="arrow-right" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ---------- Step 2: กรอกข้อมูลเล่มลูก ---------- */
        <form onSubmit={handleSubmit} className="space-y-1">
          {/* ปุ่มย้อนกลับ */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-meb-green transition"
          >
            <PhosphorIcon name="arrow-left" />
            ย้อนกลับ
          </button>

          {/* สรุปหนังสือที่เลือก */}
          {result && (
            <div className="mb-4 p-3 rounded-lg bg-meb-light/50 dark:bg-meb-green/10 text-sm">
              <span className="font-bold text-meb-green">{result.book_code}</span>
              <span className="text-forest dark:text-slate-100"> — {result.title}</span>
            </div>
          )}

          {submitError && (
            <div className="mb-4 flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 p-3 rounded-lg text-sm">
              <PhosphorIcon name="warning" weight="fill" />
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {/* จำนวนเล่ม */}
            <div>
              <label
                htmlFor="count"
                className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
              >
                จำนวนเล่มที่เพิ่ม
              </label>
              <input
                id="count"
                name="count"
                type="number"
                min={1}
                defaultValue={1}
                required
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>

            {/* สภาพเล่ม */}
            <div>
              <label
                htmlFor="condition"
                className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
              >
                สภาพ
              </label>
              <select
                id="condition"
                name="condition"
                defaultValue="new"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              >
                {Object.entries(CONDITION_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* ราคา */}
            <div className="sm:col-span-2">
              <label
                htmlFor="price"
                className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
              >
                ราคาต่อเล่ม (บาท) — ไม่บังคับ
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
          </div>

          <SubmitButton loading={pending}>
            <PhosphorIcon name="plus" weight="bold" />
            เพิ่มเล่มลูก
          </SubmitButton>
        </form>
      )}
    </Modal>
  );
}