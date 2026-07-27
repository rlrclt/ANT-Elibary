"use client";

import { useTheme } from "./theme-provider";
import { PhosphorIcon } from "./phosphor-icon";

/**
 * ThemeToggle — ปุ่มสลับ light/dark
 * โชว์ไอคอนตาม theme ปัจจุบัน (sun = light, moon = dark)
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className={`flex items-center justify-center text-2xl hover:text-meb-light transition-colors focus:outline-none rounded ${className}`}
      aria-label={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      title={theme === "dark" ? "โหมดสว่าง" : "โหมดมืด"}
    >
      <PhosphorIcon name={theme === "dark" ? "sun" : "moon"} weight="fill" />
    </button>
  );
}