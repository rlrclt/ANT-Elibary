"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhosphorIcon } from "../../../components/phosphor-icon";

type BookInfo = {
  id: string;
  book_code: string;
  title: string;
  author: string | null;
  cover_image_url: string | null;
  shelf_location: string | null;
  publisher: string | null;
  isbn: string | null;
  category_name: string | null;
  category_color: string | null;
};

type AvailableCopy = {
  id: string;
  barcode: string;
  condition: string;
};

type Profile = {
  full_name: string;
  user_id_code: string;
  borrow_limit: number;
  active_borrows: number;
  status: string;
  fine_balance: number;
};

type BorrowClientProps = {
  book: BookInfo;
  availableCopies: AvailableCopy[];
  profile: Profile;
  canBorrow: boolean;
  userId: string;
};

/** สร้าง URL รูป placeholder */
function fallbackCover(title: string) {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `book cover ${title} thai textbook`,
  )}&image_size=portrait_4_3`;
}

/** แปลงสภาพเป็นไทย */
const conditionLabel: Record<string, string> = {
  new: "มือหนึ่ง",
  good: "สภาพดี",
  fair: "สภาพพอใช้",
  poor: "สภาพไม่ดี",
};

const conditionColor: Record<string, string> = {
  new: "bg-meb-light text-meb-green",
  good: "bg-blue-50 text-blue-600",
  fair: "bg-amber-50 text-amber-600",
  poor: "bg-red-50 text-price-red",
};

/**
 * BorrowClient — หน้ายืมหนังสือ
 * แสดงข้อมูลหนังสือ + เลือกเล่มลูก + ยืนยันการยืม
 */
export function BorrowClient({
  book,
  availableCopies,
  profile,
  canBorrow,
  userId,
}: BorrowClientProps) {
  const router = useRouter();
  const [selectedCopy, setSelectedCopy] = useState<AvailableCopy | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [borrowedBarcode, setBorrowedBarcode] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  function handleBorrow() {
    if (!selectedCopy) {
      setError("กรุณาเลือกเล่มที่ต้องการยืม");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        // ใช้ member loans action (ที่มีอยู่แล้ว)
        const { memberBorrowAction } = await import("../../loans/actions");
        const formData = new FormData();
        formData.set("barcode", selectedCopy.barcode);
        const result = await memberBorrowAction(formData);

        if (result.error) {
          setError(result.error);
          return;
        }

        setBorrowedBarcode(selectedCopy.barcode);
        // คำนวณวันกำหนดคืน = วันนี้ + 14 วัน
        const due = new Date();
        due.setDate(due.getDate() + 14);
        setDueDate(
          due.toLocaleDateString("th-TH", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        );
        setSuccess(true);
        // redirect ไปหน้าการยืมหลัง 2 วินาที
        setTimeout(() => {
          router.push("/member/loans");
          router.refresh();
        }, 2000);
      } catch (err) {
        setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    });
  }

  // --- หน้าสำเร็จ ---
  if (success) {
    return (
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-8 text-center max-w-md mx-auto transition-colors">
        <div className="w-16 h-16 mx-auto rounded-full bg-meb-light flex items-center justify-center text-meb-green text-3xl mb-4">
          <PhosphorIcon name="check-circle" weight="fill" />
        </div>
        <h1 className="text-xl font-bold text-forest dark:text-slate-100 mb-2">
          ยืมหนังสือสำเร็จ!
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          {book.title}
        </p>
        <p className="text-xs font-mono text-meb-green mb-4">{borrowedBarcode}</p>

        {/* แจ้งวันกำหนดคืน — เด่นชัด */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <PhosphorIcon name="calendar-x" weight="fill" className="text-xl text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
              กำหนดส่งคืน
            </p>
          </div>
          <p className="text-lg font-bold text-amber-800 dark:text-amber-300">
            {dueDate}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            กรุณานำหนังสือมาคืนก่อนหรือภายในวันที่ระบุ
          </p>
        </div>

        {/* ข้อมูลเพิ่มเติม */}
        <div className="bg-meb-light/50 border border-meb-green/30 rounded-md p-3 mb-6">
          <p className="text-xs text-meb-hover flex items-center justify-center gap-1.5">
            <PhosphorIcon name="clock" weight="fill" className="text-sm" />
            สามารถต่ออายุได้ 1 ครั้ง อีก 7 วัน (กรุณาติดต่อเจ้าหน้าที่หรือทำผ่านระบบ)
          </p>
        </div>

        <p className="text-xs text-slate-400">กำลังนำคุณไปหน้าการยืมของฉัน...</p>
      </section>
    );
  }

  // --- หน้าหลัก ---
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
        <Link href="/member" className="hover:text-meb-green">หน้าแรก</Link>
        <PhosphorIcon name="caret-right" className="text-xs" />
        <Link href={`/member/books/${book.id}`} className="hover:text-meb-green truncate max-w-[200px]">
          {book.title}
        </Link>
        <PhosphorIcon name="caret-right" className="text-xs" />
        <span className="text-slate-600 dark:text-slate-300 font-medium">ยืมหนังสือ</span>
      </nav>

      {/* ข้อมูลหนังสือ */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* ปก */}
          <div className="w-32 sm:w-36 shrink-0 mx-auto sm:mx-0">
            <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-border-base bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={book.cover_image_url || fallbackCover(book.title)}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* รายละเอียด */}
          <div className="flex-1 min-w-0">
            {book.category_name && (
              <span
                className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2"
                style={{
                  backgroundColor: (book.category_color ?? "#60a5fa") + "20",
                  color: book.category_color ?? "#60a5fa",
                }}
              >
                {book.category_name}
              </span>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-forest dark:text-slate-100 mb-1">
              {book.title}
            </h1>
            {book.author && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                โดย {book.author}
              </p>
            )}
            <dl className="space-y-1 text-sm">
              {book.publisher && (
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-24 shrink-0">สำนักพิมพ์</dt>
                  <dd className="text-slate-700 dark:text-slate-300">{book.publisher}</dd>
                </div>
              )}
              {book.isbn && (
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-24 shrink-0">ISBN</dt>
                  <dd className="text-slate-700 dark:text-slate-300 font-mono text-xs">{book.isbn}</dd>
                </div>
              )}
              {book.shelf_location && (
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-24 shrink-0">พิกัดชั้นวาง</dt>
                  <dd className="text-slate-700 dark:text-slate-300">{book.shelf_location}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-slate-400 w-24 shrink-0">รหัสหนังสือ</dt>
                <dd className="text-meb-green font-mono text-xs font-bold">{book.book_code}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* สถานะสมาชิก */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        <h2 className="text-sm font-bold text-forest dark:text-slate-100 mb-3 flex items-center gap-2">
          <PhosphorIcon name="user-circle" weight="fill" className="text-meb-green" />
          สถานะสมาชิก
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">ยืมปัจจุบัน</p>
            <p className="text-lg font-bold text-forest dark:text-slate-100">
              {profile.active_borrows}
              <span className="text-xs text-slate-400">/{profile.borrow_limit}</span>
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">สถานะ</p>
            <p className={`text-sm font-bold ${profile.status === "active" ? "text-meb-green" : "text-price-red"}`}>
              {profile.status === "active" ? "ใช้งานได้" : "ระงับ"}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">ค่าปรับคงค้าง</p>
            <p className={`text-sm font-bold ${profile.fine_balance > 0 ? "text-price-red" : "text-meb-green"}`}>
              ฿{profile.fine_balance.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">ระยะเวลายืม</p>
            <p className="text-sm font-bold text-forest dark:text-slate-100">14 วัน</p>
          </div>
        </div>
      </section>

      {/* ไม่สามารถยืมได้ */}
      {!canBorrow && (
        <section className="bg-price-red/10 border border-price-red/30 rounded-xl p-5 text-center">
          <PhosphorIcon name="warning-circle" weight="fill" className="text-2xl text-price-red mx-auto mb-2" />
          <h2 className="text-base font-bold text-price-red mb-1">
            ไม่สามารถยืมหนังสือได้
          </h2>
          <p className="text-sm text-price-red/80 mb-4">
            {profile.status !== "active"
              ? "บัญชีของคุณถูกระงับ กรุณาติดต่อเจ้าหน้าที่"
              : profile.active_borrows >= profile.borrow_limit
                ? `คุณยืมครบจำนวนสูงสุดแล้ว (${profile.active_borrows}/${profile.borrow_limit} เล่ม) กรุณาคืนหนังสือก่อนยืมใหม่`
                : "กรุณาติดต่อเจ้าหน้าที่"}
          </p>
          <Link
            href={`/member/books/${book.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-meb-green transition"
          >
            <PhosphorIcon name="caret-left" weight="bold" />
            กลับไปหน้าหนังสือ
          </Link>
        </section>
      )}

      {/* เลือกเล่มลูก + ยืนยัน */}
      {canBorrow && (
        <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 sm:p-6 transition-colors">
          <h2 className="text-sm font-bold text-forest dark:text-slate-100 mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-border-base pb-3">
            <PhosphorIcon name="books" weight="fill" className="text-meb-green" />
            เลือกเล่มที่ต้องการยืม
          </h2>

          {error && (
            <div className="mb-4 flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md">
              <PhosphorIcon name="warning-circle" weight="fill" />
              {error}
            </div>
          )}

          {availableCopies.length === 0 ? (
            <div className="text-center py-8">
              <PhosphorIcon name="x-circle" weight="fill" className="text-3xl text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                หนังสือเล่มนี้ถูกยืมครบทั้งหมดแล้ว
              </p>
              <p className="text-xs text-slate-400 mt-1">
                กรุณาตรวจสอบอีกครั้งภายหลัง
              </p>
            </div>
          ) : (
            <>
              {/* รายการเล่มลูก */}
              <div className="space-y-2 mb-5">
                {availableCopies.map((copy) => {
                  const selected = selectedCopy?.id === copy.id;
                  return (
                    <button
                      key={copy.id}
                      onClick={() => setSelectedCopy(copy)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition text-left ${
                        selected
                          ? "border-meb-green bg-meb-light/50"
                          : "border-gray-200 dark:border-border-base hover:border-meb-green/30 bg-white dark:bg-card-bg"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            selected
                              ? "bg-meb-green text-white"
                              : "bg-gray-100 dark:bg-white/10 text-slate-400"
                          }`}
                        >
                          <PhosphorIcon
                            name={selected ? "check" : "book"}
                            weight={selected ? "bold" : "regular"}
                            className="text-sm"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-mono font-bold text-forest dark:text-slate-100">
                            {copy.barcode}
                          </p>
                          <p className="text-xs text-slate-400">
                            {conditionLabel[copy.condition] ?? copy.condition}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          conditionColor[copy.condition] ?? "bg-gray-100 text-slate-500"
                        }`}
                      >
                        {conditionLabel[copy.condition] ?? copy.condition}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ปุ่มยืนยัน */}
              <div className="flex gap-2">
                <button
                  onClick={handleBorrow}
                  disabled={!selectedCopy || pending}
                  className="btn-cta flex-1 inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-3.5 rounded-md text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pending ? (
                    <>
                      <PhosphorIcon name="circle-notch" className="animate-spin" />
                      กำลังยืม...
                    </>
                  ) : (
                    <>
                      <PhosphorIcon name="arrow-circle-right" weight="fill" />
                      ยืนยันการยืม
                    </>
                  )}
                </button>
                <Link
                  href={`/member/books/${book.id}`}
                  className="px-5 py-3.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
                >
                  ยกเลิก
                </Link>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}