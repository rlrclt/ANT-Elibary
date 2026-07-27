"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PhosphorIcon } from "../../components/phosphor-icon";
import { toggleFavoriteAction } from "../favorites/actions";

export type MemberBook = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount?: number;
  isFree?: boolean;
  /** สถานะรายการโปรด — ถ้า true จะแสดงหัวใจสีแดง */
  isFavorited?: boolean;
};

type BadgeStyle = "rank" | "discount" | "ribbon" | "none";

type MemberBookCardProps = {
  book: MemberBook;
  badge?: BadgeStyle;
  rank?: number;
};

/**
 * MemberBookCard — การ์ดหนังสือสำหรับหน้า member
 * - ปก + ชื่อ + ผู้แต่ง + ดาว + ราคา
 * - ปุ่มหัวใจรายการโปรด (กด toggle ได้)
 * - รองรับ badge: rank/discount/ribbon/none
 */
export function MemberBookCard({
  book,
  badge = "none",
  rank,
}: MemberBookCardProps) {
  const [favorited, setFavorited] = useState(book.isFavorited ?? false);
  const [pending, startTransition] = useTransition();

  // คำนวณเปอร์เซ็นต์ส่วนลด
  const discountPercent =
    book.originalPrice && book.originalPrice > book.price
      ? Math.round(
          ((book.originalPrice - book.price) / book.originalPrice) * 100,
        )
      : 0;

  // ดาว — full / half / empty
  const full = Math.floor(book.rating);
  const hasHalf = book.rating - full >= 0.5;

  // toggle favorite
  function handleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("bookId", book.id);
        const res = await toggleFavoriteAction(formData);
        if (res.error) {
          // ถ้ายังไม่ได้ login → ไม่ toggle แค่แจ้ง error เงียบๆ
          console.warn("[favorite]", res.error);
          return;
        }
        setFavorited(res.isFavorited);
      } catch (err) {
        // session หมดอายุ → server action redirect ไป /login → จับ error ไว้
        console.warn("[favorite] session หมดอายุ หรือไม่ได้ login");
      }
    });
  }

  return (
    <Link
      href={`/member/books/${book.id}`}
      className="group flex flex-col cursor-pointer"
    >
      {/* ปกหนังสือ */}
      <div
        className="relative w-full rounded-md overflow-hidden shadow-sm border border-gray-200 dark:border-border-base mb-2 bg-gray-100 dark:bg-card-bg"
        style={{ aspectRatio: "1 / 1.4" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
        />

        {/* Badge: เหรียญอันดับ */}
        {badge === "rank" && rank !== undefined && (
          <span
            className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md border-2 border-white ${rankBadgeClass(
              rank,
            )}`}
          >
            {rank}
          </span>
        )}

        {/* Badge: % ส่วนลด */}
        {badge === "discount" && discountPercent > 0 && (
          <span className="absolute top-0 left-0 bg-price-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-md shadow">
            -{discountPercent}%
          </span>
        )}

        {/* Badge: ริบบอน "ฟรี" */}
        {badge === "ribbon" && (
          <div className="absolute top-0 right-2 w-7 h-9 bg-ribbon-red meb-ribbon flex items-start justify-center pt-1.5 shadow-md">
            <PhosphorIcon
              name="fire"
              weight="fill"
              className="text-[12px] text-white"
            />
          </div>
        )}

        {/* ปุ่มหัวใจรายการโปรด — มุมขวาบน */}
        <button
          onClick={handleFavorite}
          disabled={pending}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur flex items-center justify-center hover:bg-white dark:hover:bg-black/60 transition shadow-sm"
          aria-label={favorited ? "ลบจากรายการโปรด" : "เพิ่มรายการโปรด"}
        >
          {pending ? (
            <PhosphorIcon name="circle-notch" className="text-sm text-slate-400 animate-spin" />
          ) : (
            <PhosphorIcon
              name="heart"
              weight={favorited ? "fill" : "regular"}
              className={`text-sm transition ${
                favorited
                  ? "text-price-red"
                  : "text-slate-600 dark:text-slate-300 hover:text-price-red"
              }`}
            />
          )}
        </button>
      </div>

      {/* ชื่อหนังสือ */}
      <h3 className="text-sm font-bold line-clamp-2 mb-1 group-hover:text-meb-green transition leading-snug text-slate-800 dark:text-slate-100">
        {book.title}
      </h3>

      {/* ผู้แต่ง */}
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1.5">
        {book.author}
      </p>

      {/* ดาว + ราคา */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        {/* ดาว 5 ดวง + คะแนนเฉลี่ย + จำนวนรีวิว */}
        <div className="flex flex-col gap-0.5 text-xs">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => {
              if (i < full) {
                return (
                  <PhosphorIcon
                    key={i}
                    name="star"
                    weight="fill"
                    className="text-yellow-400"
                  />
                );
              }
              if (i === full && hasHalf) {
                return (
                  <PhosphorIcon
                    key={i}
                    name="star-half"
                    weight="fill"
                    className="text-yellow-400"
                  />
                );
              }
              return (
                <PhosphorIcon
                  key={i}
                  name="star"
                  className="text-slate-300"
                />
              );
            })}
          </div>
          {book.reviewCount !== undefined && book.reviewCount > 0 && (
            <span className="text-[10px] text-slate-400">
              ⭐ {book.rating.toFixed(1)} ({book.reviewCount} รีวิว)
            </span>
          )}
        </div>

        {/* ราคา */}
        <div className="flex flex-col items-end leading-tight">
          {book.isFree ? (
            <span className="text-sm font-bold text-meb-green">ฟรี</span>
          ) : book.originalPrice && book.originalPrice > book.price ? (
            <>
              <span className="text-[10px] line-through text-slate-400">
                ฿{book.originalPrice.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-price-red">
                ฿{book.price.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-meb-green">
              ฿{book.price.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** คลาส gradient สำหรับเหรียญอันดับ (ใช้กับ .rank-* ใน globals.css) */
function rankBadgeClass(rank: number): string {
  if (rank === 1) return "rank-gold";
  if (rank === 2) return "rank-silver";
  if (rank === 3) return "rank-bronze";
  return "rank-black";
}