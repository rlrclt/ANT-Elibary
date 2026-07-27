"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { rateBookAction } from "../actions";

type StarRatingProps = {
  bookId: string;
  initialRating: number; // คะแนนของผู้ใช้คนนี้ (0 = ยังไม่ให้)
  initialAvg: number;
  initialCount: number;
};

/**
 * StarRating — ระบบให้ดาวหนังสือ
 * - ด้านบน: ดาวโต้ตอบได้ (คลิกเพื่อให้คะแนน 1-5) + ข้อความ "คุณให้ X ดาว"
 * - ด้านล่าง: คะแนนเฉลี่ยแสดงเป็นดาว (รองรับครึ่งดาว) + "(N รีวิว)"
 * - Hover effect: ดาวจะเติมเต็มตามตำแหน่งเมาส์
 * - สีดาวที่เติม: yellow-400
 */
export function StarRating({
  bookId,
  initialRating,
  initialAvg,
  initialCount,
}: StarRatingProps) {
  const [myRating, setMyRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [isPending, startTransition] = useTransition();

  function handleRate(rating: number) {
    if (isPending) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("bookId", bookId);
      formData.set("rating", String(rating));
      const res = await rateBookAction(formData);
      if (!res.error) {
        setMyRating(rating);
      }
    });
  }

  // ค่าที่จะแสดง (ถ้า hover ใช้ค่า hover, ถ้าไม่ hover ใช้ค่าที่ผู้ใช้ให้ไว้)
  const displayRating = hoverRating > 0 ? hoverRating : myRating;

  // คำนวณดาวเฉลี่ย (full / half / empty)
  const avgFull = Math.floor(initialAvg);
  const avgHasHalf = initialAvg - avgFull >= 0.5;

  return (
    <div className="space-y-2">
      {/* ===== ดาวโต้ตอบ (ให้คะแนน) ===== */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => {
            const starValue = i + 1;
            const isFilled = starValue <= displayRating;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleRate(starValue)}
                onMouseEnter={() => setHoverRating(starValue)}
                onMouseLeave={() => setHoverRating(0)}
                disabled={isPending}
                aria-label={`ให้ ${starValue} ดาว`}
                className="p-0.5 transition disabled:opacity-60 cursor-pointer"
              >
                <PhosphorIcon
                  name="star"
                  weight={isFilled ? "fill" : "regular"}
                  className={`text-2xl ${
                    isFilled
                      ? "text-yellow-400"
                      : "text-slate-300 dark:text-slate-600 hover:text-yellow-400/50"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* สถานะการให้คะแนน */}
        {isPending ? (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <PhosphorIcon
              name="circle-notch"
              className="animate-spin text-sm"
            />
            กำลังบันทึก...
          </span>
        ) : myRating > 0 ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            คุณให้ {myRating} ดาว
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            คลิกเพื่อให้คะแนน
          </span>
        )}
      </div>

      {/* ===== คะแนนเฉลี่ย ===== */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => {
            if (i < avgFull) {
              return (
                <PhosphorIcon
                  key={i}
                  name="star"
                  weight="fill"
                  className="text-base text-yellow-400"
                />
              );
            }
            if (i === avgFull && avgHasHalf) {
              return (
                <span
                  key={i}
                  className="relative inline-block"
                  style={{ width: "1em", height: "1em" }}
                >
                  <PhosphorIcon
                    name="star"
                    className="text-base text-slate-300 dark:text-slate-600 absolute inset-0"
                  />
                  <span
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: "50%" }}
                  >
                    <PhosphorIcon
                      name="star"
                      weight="fill"
                      className="text-base text-yellow-400"
                    />
                  </span>
                </span>
              );
            }
            return (
              <PhosphorIcon
                key={i}
                name="star"
                className="text-base text-slate-300 dark:text-slate-600"
              />
            );
          })}
        </div>
        <span>
          ⭐ {initialAvg > 0 ? initialAvg.toFixed(1) : "—"} ({initialCount}{" "}
          รีวิว)
        </span>
      </div>
    </div>
  );
}