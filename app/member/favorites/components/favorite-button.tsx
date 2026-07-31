"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { toggleFavoriteAction } from "../actions";

type FavoriteButtonProps = {
  bookId: string;
  initialFavorited: boolean;
  size?: "sm" | "md" | "lg";
};

/**
 * FavoriteButton — ปุ่มสลับรายการโปรด (heart/bookmark)
 * - คลิกเพื่อเพิ่ม/ลบรายการโปรด (toggleFavoriteAction)
 * - sm: ไอคอนอย่างเดียว 20px (ใช้ในการ์ด)
 * - md: ไอคอน + ข้อความ (ขนาดปกติ)
 * - lg: ไอคอน + ข้อความใหญ่ (ใช้ในหน้ารายละเอียด)
 * - เมื่อโปรดแล้ว → หัวใจสีแดง/terracotta (fill)
 * - มี spinner ตอนกำลังประมวลผล
 */
export function FavoriteButton({
  bookId,
  initialFavorited,
  size = "md",
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (isPending) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("bookId", bookId);
      const res = await toggleFavoriteAction(formData);
      if (!res.error) {
        setIsFavorited(res.isFavorited);
      }
    });
  }

  // สีและขนาดตาม variant
  const iconColor = isFavorited
    ? "text-price-red dark:text-price-red"
    : "text-meb-green";

  const tooltip = isFavorited
    ? "ลบจากรายการโปรด"
    : "เพิ่มรายการโปรด";

  // ขนาดตาม variant
  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        title={tooltip}
        aria-label={tooltip}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/80 dark:bg-card-bg/80 hover:bg-meb-light dark:hover:bg-meb-green/10 shadow-sm border border-gray-100 dark:border-border-base transition disabled:opacity-60"
      >
        {isPending ? (
          <PhosphorIcon
            name="circle-notch"
            className="text-[20px] text-slate-400 animate-spin"
          />
        ) : (
          <PhosphorIcon
            name="heart"
            weight={isFavorited ? "fill" : "regular"}
            className={`text-[20px] ${iconColor}`}
          />
        )}
      </button>
    );
  }

  // md / lg — ไอคอน + ข้อความ
  const sizeClasses =
    size === "lg"
      ? "py-3 text-base gap-2"
      : "py-2.5 text-sm gap-1.5";

  const label = isFavorited ? "รายการโปรด" : "เพิ่มรายการโปรด";

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      title={tooltip}
      className={`flex items-center justify-center w-full rounded-lg border font-semibold transition disabled:opacity-60 ${sizeClasses} ${
        isFavorited
          ? "border-price-red text-price-red bg-price-red/5 dark:bg-price-red/10 hover:bg-price-red/10 dark:hover:bg-price-red/15"
          : "border-meb-green text-meb-green hover:bg-meb-light dark:hover:bg-meb-green/10"
      }`}
    >
      {isPending ? (
        <PhosphorIcon
          name="circle-notch"
          weight="fill"
          className={size === "lg" ? "text-lg animate-spin" : "text-base animate-spin"}
        />
      ) : (
        <PhosphorIcon
          name="heart"
          weight={isFavorited ? "fill" : "regular"}
          className={size === "lg" ? "text-lg" : "text-base"}
        />
      )}
      {label}
    </button>
  );
}