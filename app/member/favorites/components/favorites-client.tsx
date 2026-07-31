"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  toggleFavoriteAction,
  type FavoriteBook,
} from "../actions";

type FavoritesClientProps = {
  initialFavorites: FavoriteBook[];
};

/**
 * FavoritesClient — คอนโทรลเลอร์ฝั่ง client สำหรับหน้ารายการโปรด
 * จัดการการลบรายการโปรด + อัปเดตรายการที่แสดงผลทันที
 */
export function FavoritesClient({ initialFavorites }: FavoritesClientProps) {
  const [favorites, setFavorites] = useState(initialFavorites);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleRemove(bookId: string, favoriteId: string) {
    if (removingId) return;
    setRemovingId(favoriteId);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("bookId", bookId);
      const res = await toggleFavoriteAction(formData);
      if (!res.error) {
        // ลบออกจากรายการที่แสดงผล
        setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
      }
      setRemovingId(null);
    });
  }

  if (favorites.length === 0) {
    return (
      <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-12 text-center">
        <PhosphorIcon
          name="heart"
          weight="duotone"
          className="text-5xl text-slate-300 dark:text-slate-600 mb-3"
        />
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
          ยังไม่มีรายการโปรด
        </p>
        <Link
          href="/member"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-meb-green text-white text-sm font-semibold hover:bg-meb-hover transition"
        >
          <PhosphorIcon name="books" className="text-base" />
          ไปเลือกหนังสือ
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {favorites.map((book) => {
        const categoryColor = book.category_color ?? "#00a651";
        return (
          <div
            key={book.id}
            className="group bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
          >
            {/* ปกหนังสือ + ลิงก์ */}
            <Link
              href={`/member/books/${book.book_id}`}
              className="relative w-full overflow-hidden bg-gray-100 dark:bg-card-bg"
              style={{ aspectRatio: "2 / 3" }}
            >
              {book.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.cover_image_url}
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-meb-light to-gray-100 dark:from-card-bg dark:to-page-bg">
                  <PhosphorIcon
                    name="book"
                    weight="duotone"
                    className="text-5xl text-meb-green/60"
                  />
                  <span className="text-xs text-slate-400 px-4 text-center line-clamp-2">
                    {book.title}
                  </span>
                </div>
              )}
            </Link>

            {/* ข้อมูลหนังสือ */}
            <div className="p-3 flex flex-col flex-1">
              {/* ป้ายหมวดหมู่ */}
              {book.category_name && (
                <span
                  className="inline-flex items-center self-start px-2 py-0.5 rounded-full text-[10px] font-semibold text-white mb-1.5"
                  style={{ backgroundColor: categoryColor }}
                >
                  {book.category_name}
                </span>
              )}

              {/* ชื่อหนังสือ */}
              <Link href={`/member/books/${book.book_id}`}>
                <h3 className="text-sm font-bold line-clamp-2 mb-1 group-hover:text-meb-green transition leading-snug text-slate-800 dark:text-slate-100">
                  {book.title}
                </h3>
              </Link>

              {/* ผู้แต่ง */}
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">
                {book.author ?? "ไม่ระบุผู้แต่ง"}
              </p>

              {/* ปุ่มลบ */}
              <button
                type="button"
                onClick={() => handleRemove(book.book_id, book.id)}
                disabled={removingId === book.id}
                className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold text-price-red bg-price-red/5 dark:bg-price-red/10 hover:bg-price-red/10 dark:hover:bg-price-red/15 transition disabled:opacity-60"
              >
                {removingId === book.id ? (
                  <PhosphorIcon
                    name="circle-notch"
                    className="animate-spin text-sm"
                  />
                ) : (
                  <PhosphorIcon name="heart" weight="fill" className="text-sm" />
                )}
                ลบ
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}