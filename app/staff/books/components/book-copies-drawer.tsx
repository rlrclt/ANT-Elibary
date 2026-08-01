"use client";

import { useEffect, useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { useBarcodeCart, type PrintCartItem } from "./barcode-cart-context";
import {
  getBookCopiesAction,
  updateBookCopyStatusAction,
  updateBookAction,
  getCopyTimelineAction,
  createDamagedRecordAction,
  searchMemberAction,
  deleteBookCopyAction,
  type BookWithCategory,
  type BookCopy,
  type Category,
  type CopyTimelineEvent,
} from "../actions";

/**
 * book-copies-drawer — ลิสต์เล่มลูกของหนังสือ
 * Slide-in จากขวา, คลิกแถวเพื่อแก้ไขสถานะ/สภาพ/หมายเหตุ
 */
type BookCopiesDrawerProps = {
  open: boolean;
  onClose: () => void;
  book: BookWithCategory | null;
  categories?: Category[];
};

// สี badge สถานะ
const STATUS_BADGE: Record<BookCopy["status"], string> = {
  available: "bg-meb-light text-meb-green",
  borrowed: "bg-blue-50 text-blue-600",
  lost: "bg-red-50 text-price-red",
  damaged: "bg-orange-50 text-terracotta",
};

const STATUS_LABEL: Record<BookCopy["status"], string> = {
  available: "พร้อมยืม",
  borrowed: "ยืมแล้ว",
  lost: "สูญหาย",
  damaged: "ชำรุด",
};

// สี badge สภาพ
const CONDITION_BADGE: Record<BookCopy["condition"], string> = {
  new: "bg-meb-light text-meb-green",
  good: "bg-green-50 text-green-600",
  fair: "bg-yellow-50 text-yellow-600",
  poor: "bg-red-50 text-price-red",
};

const CONDITION_LABEL: Record<BookCopy["condition"], string> = {
  new: "ใหม่",
  good: "ดี",
  fair: "พอใช้",
  poor: "ชำรุด",
};

export function BookCopiesDrawer({ open, onClose, book, categories = [] }: BookCopiesDrawerProps) {
  const { addMany, has } = useBarcodeCart();
  const [copies, setCopies] = useState<BookCopy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Timeline ของเล่มลูก
  const [timelineCopy, setTimelineCopy] = useState<BookCopy | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<CopyTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // ฟอร์มแจ้งชำรุด
  const [damagedCopy, setDamagedCopy] = useState<BookCopy | null>(null);
  const [damagedUserId, setDamagedUserId] = useState("");
  const [damagedQuery, setDamagedQuery] = useState("");
  const [damagedResults, setDamagedResults] = useState<
    { id: string; full_name: string; user_id_code: string; status: string }[]
  >([]);
  const [damagedSearching, setDamagedSearching] = useState(false);
  const [damagedError, setDamagedError] = useState<string | null>(null);

  // ฟอร์มลบเล่มลูก
  const [deleteCopy, setDeleteCopy] = useState<BookCopy | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // โหลดเล่มลูกเมื่อเปิด drawer พร้อมมี book
  // ล็อก scroll พื้นหลังเมื่อเปิด drawer
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

  // โหลดเล่มลูกเมื่อเปิด drawer พร้อมมี book
  useEffect(() => {
    if (!open || !book) return;
    setLoading(true);
    setError(null);
    setExpandedId(null);
    setEditMode(false);
    setEditError(null);
    setCoverUrl(book.cover_image_url ?? "");
    setUploading(false);
    getBookCopiesAction(book.id)
      .then((res) => {
        if (res.error) setError(res.error);
        else setCopies(res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, book]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setEditError("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return;
    }

    setUploading(true);
    setEditError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/books/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "อัปโหลดล้มเหลว");
      }

      setCoverUrl(data.url);
    } catch (err: any) {
      setEditError(err.message || "เกิดข้อผิดพลาดในการอัปโหลด");
    } finally {
      setUploading(false);
    }
  }

  // submit ฟอร์มแก้ไขหนังสือแม่
  function handleEditBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!book) return;
    setEditError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("book_id", book.id);
    startTransition(async () => {
      const res = await updateBookAction(formData);
      if (res.error) {
        setEditError(res.error);
        return;
      }
      setEditMode(false);
      onClose();
    });
  }

  // ปุ่ม copy barcode ไปยัง clipboard
  function handleCopy(barcode: string) {
    navigator.clipboard.writeText(barcode).catch(() => {
      // ไม่แสดง error ตามขอบเขต
    });
  }

  // submit ฟอร์มแก้ไขเล่มลูก
  function handleUpdate(e: React.FormEvent<HTMLFormElement>, copyId: string) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("copy_id", copyId);
    startTransition(async () => {
      const res = await updateBookCopyStatusAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      // refresh รายการ
      if (book) {
        const fresh = await getBookCopiesAction(book.id);
        if (!fresh.error) setCopies(fresh.data ?? []);
      }
      setExpandedId(null);
      setError(null);
    });
  }

  // เปิด modal ดู timeline ของเล่มลูก
  async function openTimeline(copy: BookCopy) {
    setTimelineCopy(copy);
    setTimelineEvents([]);
    setTimelineLoading(true);
    const res = await getCopyTimelineAction(copy.id);
    setTimelineEvents(res.data ?? []);
    setTimelineLoading(false);
  }

  // ค้นหาสมาชิกสำหรับแจ้งชำรุด
  async function handleDamagedSearch(q: string) {
    setDamagedQuery(q);
    if (!q.trim()) {
      setDamagedResults([]);
      return;
    }
    setDamagedSearching(true);
    const res = await searchMemberAction(q);
    setDamagedResults(res.data ?? []);
    setDamagedSearching(false);
  }

  // submit แจ้งชำรุด
  function handleCreateDamaged(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!damagedCopy) return;
    if (!damagedUserId) {
      setDamagedError("กรุณาเลือกสมาชิกผู้รับผิดชอบ");
      return;
    }
    setDamagedError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("copy_id", damagedCopy.id);
    formData.set("user_id", damagedUserId);
    startTransition(async () => {
      const res = await createDamagedRecordAction(formData);
      if (res.error) {
        setDamagedError(res.error);
        return;
      }
      // refresh รายการ + ปิด modal
      if (book) {
        const fresh = await getBookCopiesAction(book.id);
        if (!fresh.error) setCopies(fresh.data ?? []);
      }
      setDamagedCopy(null);
      setDamagedUserId("");
      setDamagedQuery("");
      setDamagedResults([]);
      setDamagedError(null);
    });
  }

  // submit ลบเล่มลูก (soft-delete — ประวัติยังคงอยู่)
  function handleDeleteCopy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deleteCopy) return;
    setDeleteError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("copy_id", deleteCopy.id);
    startTransition(async () => {
      const res = await deleteBookCopyAction(formData);
      if (res.error) {
        setDeleteError(res.error);
        return;
      }
      // refresh รายการ + ปิด modal
      if (book) {
        const fresh = await getBookCopiesAction(book.id);
        if (!fresh.error) setCopies(fresh.data ?? []);
      }
      setDeleteCopy(null);
      setDeleteError(null);
    });
  }

  return (
    <>
      {/* Backdrop มืดๆ */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Bottom sheet — สไลด์ขึ้นจากล่างเต็มจอ */}
      <aside
        className={`fixed bottom-0 left-0 right-0 z-[95] h-full bg-white dark:bg-card-bg shadow-2xl rounded-t-2xl border-t border-gray-100 dark:border-border-base transition-transform duration-300 flex flex-col ${open ? "translate-y-0" : "translate-y-full"
          }`}
        aria-hidden={!open}
      >
        {/* Drag handle — แถบสีเทาด้านบน */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-border-base">
          <div className="min-w-0 pr-4 flex-1">
            {book && (
              <>
                <p className="font-bold text-meb-green text-sm">
                  {book.book_code}
                </p>
                <h2 className="text-lg font-bold text-forest dark:text-slate-100 truncate">
                  {book.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-gray-100 dark:bg-white/10 px-3 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/20 transition"
                  >
                    <PhosphorIcon name="pencil-simple" weight="bold" className="text-sm" />
                    {editMode ? "ยกเลิกแก้ไข" : "แก้ไขข้อมูลหนังสือ"}
                  </button>
                  {/* ปุ่ม "เพิ่มไปตะกร้าพิมพ์" ถูกปิดใช้งานชั่วคราว (ซ่อนฟีเจอร์ตะกร้าพิมพ์บาร์โค้ด)
                  {copies.length > 0 && (
                    <button
                      onClick={() => {
                        const items: PrintCartItem[] = copies
                          .filter((c) => !has(c.barcode))
                          .map((c) => ({
                            barcode: c.barcode,
                            bookCode: book.book_code,
                            title: book.title,
                            shelfLocation: book.shelf_location ?? undefined,
                            categoryName: book.category_name ?? undefined,
                          }));
                        const { added } = addMany(items);
                        if (added > 0) {
                          alert(`เพิ่ม ${added} รายการไปตะกร้าพิมพ์แล้ว`);
                        } else {
                          alert("เล่มเหล่านี้อยู่ในตะกร้าแล้ว");
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-meb-green bg-meb-light px-3 py-1.5 rounded-md hover:bg-meb-light/70 transition"
                    >
                      <PhosphorIcon name="shopping-cart-plus" weight="fill" className="text-sm" />
                      เพิ่มไปตะกร้าพิมพ์ ({copies.length})
                    </button>
                  )}
                  */}
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 transition"
            aria-label="ปิด"
          >
            <PhosphorIcon name="x" className="text-xl" />
          </button>
        </div>

        {/* ฟอร์มแก้ไขหนังสือแม่ */}
        {editMode && book && (
          <form
            onSubmit={handleEditBook}
            className="p-4 border-b border-gray-100 dark:border-border-base bg-gray-50 dark:bg-black/20 space-y-3"
          >
            {editError && (
              <div className="flex items-center gap-2 text-price-red text-xs bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-md">
                <PhosphorIcon name="warning-circle" weight="fill" className="text-sm" />
                {editError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField label="ชื่อหนังสือ" name="title" defaultValue={book.title} required />
              <InputField label="ผู้แต่ง" name="author" defaultValue={book.author ?? ""} />
              <InputField label="ISBN" name="isbn" defaultValue={book.isbn ?? ""} />
              <InputField label="สำนักพิมพ์" name="publisher" defaultValue={book.publisher ?? ""} />
              <InputField label="ปีที่พิมพ์ (ค.ศ.)" name="publication_year" type="number" min={1900} max={new Date().getFullYear()} defaultValue={book.publication_year ?? ""} helper={book.is_old_eligible && book.status !== "old" ? "หนังสือนี้มีอายุครบ 5 ปีแล้ว" : undefined} />
              <InputField label="พิกัดชั้นวาง" name="shelf_location" defaultValue={book.shelf_location ?? ""} />
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                  รูปปกหนังสือ
                </label>
                <div className="flex gap-2 items-start">
                  {coverUrl ? (
                    <div className="relative w-12 h-16 rounded border border-gray-200 dark:border-border-base overflow-hidden shrink-0 bg-gray-50 dark:bg-white/5">
                      <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCoverUrl("")}
                        className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5"
                        title="ลบรูปภาพ"
                      >
                        <PhosphorIcon name="x" className="text-[10px]" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-16 rounded border-2 border-dashed border-gray-200 dark:border-border-base flex items-center justify-center shrink-0 text-slate-400">
                      <PhosphorIcon name="image" className="text-xl" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      name="cover_image_url"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="ใส่ URL รูปภาพ หรือกดอัปโหลด..."
                      className="w-full pl-2 pr-2 py-1.5 text-xs bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none transition focus:border-meb-green text-forest dark:text-slate-100"
                    />
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-meb-green bg-meb-light hover:bg-meb-light/80 rounded transition">
                        {uploading ? (
                          <PhosphorIcon name="circle-notch" className="animate-spin" />
                        ) : (
                          <PhosphorIcon name="upload-simple" weight="bold" />
                        )}
                        {uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูปภาพ"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[9px] text-slate-500">
                        สูงสุด 5MB
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">หมวดหมู่</label>
                <select
                  name="category_id"
                  defaultValue={book.category_id ?? ""}
                  className="w-full pl-2 pr-2 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green text-forest dark:text-slate-100"
                >
                  <option value="">— ไม่ระบุ —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">สถานะ</label>
                <select
                  name="status"
                  defaultValue={book.status}
                  className="w-full pl-2 pr-2 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green text-forest dark:text-slate-100"
                >
                  <option value="active">ใช้งาน</option>
                  <option value="lost">สูญหาย</option>
                  <option value="removed">ถอดจากระบบ</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60"
            >
              {pending ? (
                <PhosphorIcon name="circle-notch" className="animate-spin" />
              ) : (
                <PhosphorIcon name="check" weight="bold" />
              )}
              บันทึกการแก้ไข
            </button>
          </form>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 pb-5 pt-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <PhosphorIcon name="circle-notch" className="text-3xl animate-spin mb-2" />
              <p className="text-sm">กำลังโหลด...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-price-red bg-red-50 dark:bg-red-500/10 p-3 rounded-lg text-sm">
              <PhosphorIcon name="warning" weight="fill" />
              {error}
            </div>
          ) : copies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
              <PhosphorIcon name="book-open" className="text-5xl mb-3" />
              <p className="text-sm">ยังไม่มีเล่มลูก</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {copies.map((copy) => (
                <li
                  key={copy.id}
                  className="rounded-lg border border-gray-100 dark:border-border-base overflow-hidden"
                >
                  {/* แถวเล่มลูก — คลิกเพื่อขยายแก้ไข */}
                  <div
                    onClick={() =>
                      setExpandedId(expandedId === copy.id ? null : copy.id)
                    }
                    className="p-3 cursor-pointer hover:bg-meb-light/50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-sm text-forest dark:text-slate-100 truncate">
                          {copy.barcode}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(copy.barcode);
                          }}
                          className="shrink-0 p-1 rounded text-slate-400 hover:text-meb-green hover:bg-meb-light/50 transition"
                          aria-label="คัดลอกบาร์โค้ด"
                        >
                          <PhosphorIcon name="copy" className="text-sm" />
                        </button>
                      </div>
                      <PhosphorIcon
                        name={expandedId === copy.id ? "caret-up" : "caret-down"}
                        className="text-slate-400 shrink-0"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[copy.status]}`}
                      >
                        {STATUS_LABEL[copy.status]}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CONDITION_BADGE[copy.condition]}`}
                      >
                        {CONDITION_LABEL[copy.condition]}
                      </span>
                      {copy.price != null && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ฿{copy.price}
                        </span>
                      )}
                      {copy.note && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate ml-1">
                          — {copy.note}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTimeline(copy);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition"
                      >
                        <PhosphorIcon name="clock-counter-clockwise" className="text-xs" />
                        ดูประวัติ
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDamagedCopy(copy);
                          setDamagedUserId("");
                          setDamagedQuery("");
                          setDamagedResults([]);
                          setDamagedError(null);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-price-red bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition"
                      >
                        <PhosphorIcon name="warning-circle" className="text-xs" />
                        แจ้งชำรุด
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteCopy(copy);
                          setDeleteError(null);
                        }}
                        disabled={copy.status === "borrowed" || copy.status === "lost"}
                        title={
                          copy.status === "borrowed"
                            ? "ไม่สามารถลบได้ — เล่มนี้กำลังถูกยืมอยู่"
                            : copy.status === "lost"
                              ? "ไม่สามารถลบได้ — เล่มนี้ถูกแจ้งสูญหายอยู่"
                              : "ลบเล่มลูกออกจากระบบ"
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <PhosphorIcon name="trash" className="text-xs" />
                        ลบเล่ม
                      </button>
                    </div>
                  </div>

                  {/* ฟอร์มแก้ไขแบบ inline */}
                  {expandedId === copy.id && (
                    <form
                      onSubmit={(e) => handleUpdate(e, copy.id)}
                      className="p-3 border-t border-gray-100 dark:border-border-base bg-gray-50 dark:bg-white/5 space-y-3"
                    >
                      {/* สถานะ */}
                      <div>
                        <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                          สถานะ
                        </label>
                        <select
                          name="status"
                          defaultValue={copy.status}
                          className="w-full pl-2 pr-2 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                        >
                          {Object.entries(STATUS_LABEL).map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* สภาพ */}
                      <div>
                        <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                          สภาพ
                        </label>
                        <select
                          name="condition"
                          defaultValue={copy.condition}
                          className="w-full pl-2 pr-2 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                        >
                          {Object.entries(CONDITION_LABEL).map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* หมายเหตุ */}
                      <div>
                        <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                          หมายเหตุ
                        </label>
                        <textarea
                          name="note"
                          defaultValue={copy.note ?? ""}
                          rows={2}
                          placeholder="หมายเหตุ..."
                          className="w-full pl-2 pr-2 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 resize-none"
                        />
                      </div>

                      {/* ราคา */}
                      <div>
                        <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                          ราคา (บาท)
                        </label>
                        <input
                          type="number"
                          name="price"
                          defaultValue={copy.price ?? ""}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full pl-2 pr-2 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={pending}
                        className="w-full inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-4 py-2 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {pending ? (
                          <PhosphorIcon name="circle-notch" className="animate-spin" />
                        ) : (
                          <PhosphorIcon name="check" weight="bold" />
                        )}
                        บันทึก
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ===== Modal: ดูประวัติเล่มลูก (timeline) ===== */}
      {timelineCopy && (
        <div
          className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setTimelineCopy(null)}
        >
          <div
            className="bg-white dark:bg-card-bg rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-forest dark:text-slate-100">
                  ประวัติเล่ม {timelineCopy.barcode}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {book?.title ?? "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTimelineCopy(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <PhosphorIcon name="x" />
              </button>
            </div>

            {timelineLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <PhosphorIcon name="circle-notch" className="animate-spin text-3xl" />
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <PhosphorIcon name="book" className="text-4xl mx-auto mb-2" />
                <p className="text-sm">ยังไม่มีประวัติ</p>
              </div>
            ) : (
              <div className="relative">
                {/* เส้นเวลา */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200 dark:bg-white/10" />
                <div className="space-y-3">
                  {timelineEvents.map((ev) => (
                    <div key={ev.id} className="relative flex gap-3 pl-1">
                      <div
                        className={`shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center z-10 ${
                          ev.type === "damaged"
                            ? "bg-red-100 text-price-red"
                            : ev.type === "paid"
                              ? "bg-meb-light text-meb-green"
                              : ev.type === "replaced"
                                ? "bg-blue-100 text-blue-600"
                                : ev.type === "removed"
                                  ? "bg-slate-100 text-slate-500 dark:bg-white/10"
                                  : "bg-gray-100 text-slate-500 dark:bg-white/10"
                        }`}
                      >
                        <PhosphorIcon
                          name={
                            ev.type === "damaged"
                              ? "warning"
                              : ev.type === "paid"
                                ? "currency-circle-dollar"
                                : ev.type === "replaced"
                                  ? "arrows-clockwise"
                                  : ev.type === "removed"
                                    ? "trash"
                                    : ev.type === "created"
                                      ? "plus"
                                      : "book"
                          }
                          weight="fill"
                          className="text-[11px]"
                        />
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-forest dark:text-slate-100">
                            {ev.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(ev.at).toLocaleString("th-TH", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </span>
                        </div>
                        {ev.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Modal: แจ้งชำรุด ===== */}
      {damagedCopy && (
        <div
          className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDamagedCopy(null)}
        >
          <div
            className="bg-white dark:bg-card-bg rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-forest dark:text-slate-100">
                  แจ้งหนังสือชำรุด
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เล่ม {damagedCopy.barcode} จะถูกปิดการยืม และสมาชิกผู้รับผิดชอบจะถูกบล็อกจนกว่าจะชดใช้
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDamagedCopy(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <PhosphorIcon name="x" />
              </button>
            </div>

            <form onSubmit={handleCreateDamaged} className="space-y-3">
              {/* สมาชิกผู้รับผิดชอบ */}
              <div>
                <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                  สมาชิกผู้รับผิดชอบ <span className="text-price-red">*</span>
                </label>
                <input
                  type="text"
                  value={damagedQuery}
                  onChange={(e) => handleDamagedSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ / รหัสสมาชิก..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light"
                />
                {damagedSearching && (
                  <p className="text-xs text-slate-400 mt-1">
                    <PhosphorIcon name="circle-notch" className="animate-spin inline-block" />{" "}
                    กำลังค้นหา...
                  </p>
                )}
                {damagedResults.length > 0 && (
                  <div className="mt-1 bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md max-h-48 overflow-y-auto">
                    {damagedResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setDamagedUserId(m.id);
                          setDamagedQuery(`${m.full_name} (${m.user_id_code})`);
                          setDamagedResults([]);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-meb-light/50 flex items-center justify-between gap-2 ${
                          damagedUserId === m.id
                            ? "bg-meb-light text-meb-green"
                            : ""
                        }`}
                      >
                        <span>
                          <span className="font-bold">{m.full_name}</span>{" "}
                          <span className="text-slate-500">({m.user_id_code})</span>
                        </span>
                        {damagedUserId === m.id && (
                          <PhosphorIcon name="check" weight="bold" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <input type="hidden" name="user_id" value={damagedUserId} />
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                  หมายเหตุ
                </label>
                <textarea
                  name="note"
                  rows={2}
                  placeholder="ระบุลักษณะความชำรุด..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green resize-none"
                />
              </div>

              {damagedError && (
                <div className="text-price-red text-xs bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-md">
                  {damagedError}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full inline-flex items-center justify-center gap-2 bg-price-red hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60"
              >
                {pending ? (
                  <PhosphorIcon name="circle-notch" className="animate-spin" />
                ) : (
                  <PhosphorIcon name="warning" weight="fill" />
                )}
                ยืนยันแจ้งชำรุด
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: ยืนยันลบเล่มลูก ===== */}
      {deleteCopy && (
        <div
          className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDeleteCopy(null)}
        >
          <div
            className="bg-white dark:bg-card-bg rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-forest dark:text-slate-100">
                  ลบเล่มลูกออกจากระบบ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เล่ม <span className="font-mono font-bold text-forest dark:text-slate-100">{deleteCopy.barcode}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteCopy(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <PhosphorIcon name="x" />
              </button>
            </div>

            <div className="flex items-start gap-2 text-price-red bg-red-50 dark:bg-red-500/10 px-3 py-2.5 rounded-lg text-sm mb-4">
              <PhosphorIcon name="warning-circle" weight="fill" className="mt-0.5 shrink-0" />
              <p>
                เล่มนี้จะถูกถอดออกจากคลัง (ไม่นับในจำนวนเล่ม) และไม่สามารถยืมได้อีก
                แต่<b>ประวัติยืม-คืน / ชำรุด / การลบยังคงอยู่ครบ</b>ในระบบ
              </p>
            </div>

            <form onSubmit={handleDeleteCopy} className="space-y-3">
              {/* หมายเหตุ */}
              <div>
                <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
                  หมายเหตุ (เหตุผลที่ลบ)
                </label>
                <textarea
                  name="note"
                  rows={2}
                  placeholder="เช่น ชำรุดเกินซ่อม, หมดอายุ, ยกเลิกใช้..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green resize-none"
                />
              </div>

              {deleteError && (
                <div className="text-price-red text-xs bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-md">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteCopy(null)}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-md text-sm transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-price-red hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-md text-sm transition disabled:opacity-60"
                >
                  {pending ? (
                    <PhosphorIcon name="circle-notch" className="animate-spin" />
                  ) : (
                    <PhosphorIcon name="trash" weight="fill" />
                  )}
                  ยืนยันลบ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** InputField — ช่อง input สั้นๆ สำหรับฟอร์มแก้ไขหนังสือ */
function InputField({
  label,
  name,
  defaultValue,
  required,
  type,
  min,
  max,
  helper,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  required?: boolean;
  type?: string;
  min?: number;
  max?: number;
  helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-forest dark:text-slate-100 mb-1">
        {label}
        {required && <span className="text-price-red"> *</span>}
      </label>
      <input
        type={type ?? "text"}
        name={name}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        className="w-full pl-2 pr-2 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
      />
      {helper && (
        <p className="text-[10px] text-terracotta mt-1">{helper}</p>
      )}
    </div>
  );
}