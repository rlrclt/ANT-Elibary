"use client";

import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { FavoriteButton } from "../../favorites/components/favorite-button";
import { StarRating } from "../../favorites/components/star-rating";

/**
 * ประเภทข้อมูลหนังสือสำหรับหน้ารายละเอียด
 */
export type BookDetail = {
  id: string;
  book_code: string;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  synopsis: string | null;
  page_count: number | null;
  shelf_location: string | null;
  cover_image_url: string | null;
  status: string;
  total_copies: number;
  available_copies: number;
  book_categories: {
    id: string;
    name: string;
    color_code: string | null;
  } | null;
};

type CopiesCount = {
  available: number;
  borrowed: number;
  lost: number;
  damaged: number;
};

type BookDetailProps = {
  book: BookDetail;
  copiesCount: CopiesCount;
  isFavorited: boolean;
  myRating: number;
  avgRating: number;
  ratingCount: number;
};

/**
 * BookDetail — หน้ารายละเอียดหนังสือสำหรับสมาชิก
 * - ปก + ปุ่มยืม/ปุ่มโปรด + ตัวบ่งชี้ความพร้อม (ซ้าย)
 * - หมวดหมู่ + ชื่อ + ผู้แต่ง + สถิติสำเนา + เรื่องย่อ + ให้คะแนน + ตารางรายละเอียด (ขวา)
 * - ส่วนหนังสือที่เกี่ยวข้อง (placeholder)
 */
export function BookDetail({
  book,
  copiesCount,
  isFavorited,
  myRating,
  avgRating,
  ratingCount,
}: BookDetailProps) {
  const isAvailable = book.available_copies > 0;

  // สีหมวดหมู่ — fallback เขียวแบรนด์ ถ้าไม่มี color_code
  const categoryColor = book.book_categories?.color_code ?? "#00a651";

  return (
    <div className="space-y-6">
      {/* ============ Breadcrumbs ============ */}
      <nav
        aria-label="breadcrumb"
        className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap"
      >
        <Link href="/member" className="hover:text-meb-green transition">
          หน้าแรก
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        {book.book_categories ? (
          <Link
            href={`/member/category/${book.book_categories.id}`}
            className="hover:text-meb-green transition"
          >
            {book.book_categories.name}
          </Link>
        ) : (
          <Link href="/member/categories" className="hover:text-meb-green transition">
            หมวดหมู่ทั้งหมด
          </Link>
        )}
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
          {book.title}
        </span>
      </nav>

      {/* ============ Main grid ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-6">
        {/* ---------- LEFT: ปก + ปุ่ม ---------- */}
        <div className="sm:col-span-2 md:col-span-4 space-y-4">
          {/* ปกหนังสือ */}
          <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-4 sm:p-5">
            <div
              className="relative w-full max-w-[220px] mx-auto rounded-lg overflow-hidden shadow-md bg-gray-100 dark:bg-card-bg"
              style={{ aspectRatio: "2 / 3" }}
            >
              {book.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.cover_image_url}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                // Placeholder ถ้าไม่มีรูปปก
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-meb-light to-gray-100 dark:from-card-bg dark:to-page-bg p-3">
                  <PhosphorIcon
                    name="book"
                    weight="duotone"
                    className="text-3xl text-meb-green/60"
                  />
                  <span className="text-[11px] text-slate-400 text-center line-clamp-2">
                    {book.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ปุ่มยืม + ปุ่มโปรด + ตัวบ่งชี้ความพร้อม */}
          <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 space-y-3">
            {isAvailable ? (
              <Link
                href={`/member/borrow?book=${book.id}`}
                className="btn-cta flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-meb-green text-white font-bold hover:bg-meb-hover"
              >
                <PhosphorIcon name="hand-palm" weight="fill" className="text-lg" />
                ยืมหนังสือ
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-gray-200 text-gray-500 dark:bg-card-bg dark:text-slate-500 font-bold cursor-not-allowed"
              >
                <PhosphorIcon name="prohibit" className="text-lg" />
                หมดชั่วคราว
              </button>
            )}

            {/* ปุ่มเพิ่มรายการโปรด */}
            <FavoriteButton
              bookId={book.id}
              initialFavorited={isFavorited}
              size="lg"
            />
          </div>
        </div>

        {/* ---------- RIGHT: รายละเอียด ---------- */}
        <div className="sm:col-span-2 md:col-span-8 space-y-6">
          <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-4 sm:p-5 md:p-6 space-y-4">
            {/* ป้ายหมวดหมู่ */}
            {book.book_categories && (
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: categoryColor }}
              >
                {book.book_categories.name}
              </span>
            )}

            {/* ชื่อหนังสือ */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-forest dark:text-slate-100 leading-tight">
              {book.title}
            </h1>

            {/* ผู้แต่ง */}
            {book.author && (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                โดย {book.author}
              </p>
            )}

            {/* รหัสหนังสือ + ISBN */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>รหัส: {book.book_code}</span>
              {book.isbn && <span>ISBN: {book.isbn}</span>}
            </div>

            <Divider />

            {/* สถิติสำเนา */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <StatCard
                label="พร้อมยืม"
                value={copiesCount.available}
                icon="check-circle"
                color="text-meb-green"
              />
              <StatCard
                label="ยืมแล้ว"
                value={copiesCount.borrowed}
                icon="bookmark-simple"
                color="text-blue-500"
              />
              <StatCard
                label="สูญหาย"
                value={copiesCount.lost}
                icon="x-circle"
                color="text-price-red"
              />
              <StatCard
                label="ทั้งหมด"
                value={book.total_copies}
                icon="stack"
                color="text-slate-500 dark:text-slate-300"
              />
            </div>

            <Divider />

            {/* เรื่องย่อ */}
            {book.synopsis && (
              <div className="space-y-2">
                <h2 className="font-bold text-forest dark:text-slate-100">
                  เรื่องย่อ
                </h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {book.synopsis}
                </p>
              </div>
            )}

            <Divider />

            {/* ให้คะแนนหนังสือ */}
            <div className="space-y-2">
              <h2 className="font-bold text-forest dark:text-slate-100">
                ให้คะแนนหนังสือ
              </h2>
              <StarRating
                bookId={book.id}
                initialRating={myRating}
                initialAvg={avgRating}
                initialCount={ratingCount}
              />
            </div>

            <Divider />

            {/* ตารางรายละเอียด */}
            <div className="space-y-1">
              <h2 className="font-bold text-forest dark:text-slate-100 mb-2">
                รายละเอียด
              </h2>
              <DetailRow label="สำนักพิมพ์" value={book.publisher} />
              <DetailRow
                label="ISBN"
                value={book.isbn}
                mono
              />
              <DetailRow
                label="จำนวนหน้า"
                value={book.page_count != null ? `${book.page_count} หน้า` : null}
              />
              <DetailRow label="พิกัดชั้นวาง" value={book.shelf_location} />
              <DetailRow label="รหัสหนังสือ" value={book.book_code} mono />
            </div>
          </div>

          {/* ============ หนังสือที่เกี่ยวข้อง ============ */}
          <div className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-4 sm:p-5 md:p-6">
            <h2 className="font-bold text-forest dark:text-slate-100 mb-4">
              หนังสือที่เกี่ยวข้อง
            </h2>
            {/* TODO: ดึงหนังสือที่เกี่ยวข้องตามหมวดหมู่ (category_id) ในภายหลัง */}
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <PhosphorIcon
                name="books"
                weight="duotone"
                className="text-4xl text-slate-300 dark:text-slate-600 mb-3"
              />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                ยังไม่มีหนังสือที่เกี่ยวข้อง
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================== ส่วนประกอบย่อย ====================== */

/** เส้นแบ่งบรรทัด */
function Divider() {
  return <hr className="border-gray-100 dark:border-border-base" />;
}

/** การ์ดสถิติสำเนา */
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-1 py-2">
      <PhosphorIcon name={icon} weight="fill" className={`text-2xl ${color}`} />
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

/** แถวรายละเอียด — label ซ้าย (เทา) / value ขวา */
function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-border-base last:border-b-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`text-sm text-slate-800 dark:text-slate-100 text-right ${
          mono ? "font-mono" : ""
        }`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}