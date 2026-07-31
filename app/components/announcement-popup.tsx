"use client";

import { useState, useEffect, useCallback } from "react";
import { PhosphorIcon } from "./phosphor-icon";

type HomeAnnouncement = {
  id: string;
  title: string;
  body: string;
  type: string;
  action_label: string | null;
  action_url: string | null;
  image_url: string | null;
  is_pinned: boolean;
  start_at: string | null;
  end_at: string | null;
};

/**
 * AnnouncementPopup — popup ประกาศกลางจอบนหน้าแรก
 *
 * - แสดงกลางจอ (modal center) ทุกครั้งที่เข้าหน้าแรก
 * - ปุ่ม "ปิด 1 ชั่วโมง" → เก็บ timestamp ใน localStorage (รอ 1 ชม. แล้วแสดงใหม่)
 * - ปุ่ม X → ปิดชั่วคราว (ถ้ารีเฟรชหน้าจะขึ้นใหม่)
 * - รองรับหลายประกาศ → เลื่อนซ้าย/ขวา ด้วยปุ่ม หรือ จุด
 * - มีรูปภาพ + action button (ถ้ามี)
 */

// key สำหรับ localStorage — เก็บเวลาที่ผู้ใช้กด "ปิด 1 ชั่วโมง"
const SNOOZE_KEY = "announcements_snooze_until";
const SNOOZE_DURATION = 60 * 60 * 1000; // 1 ชั่วโมง (ms)

export function AnnouncementPopup({ items }: { items: HomeAnnouncement[] }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [snoozed, setSnoozed] = useState(false);

  // เช็คว่าอยู่ในช่วง snooze หรือไม่
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SNOOZE_KEY);
      if (raw) {
        const until = parseInt(raw, 10);
        if (Date.now() < until) {
          setSnoozed(true);
          return;
        }
        // หมดอายุแล้ว → ลบออก
        localStorage.removeItem(SNOOZE_KEY);
      }
    } catch {
      // localStorage ไม่ available → ข้าม
    }

    // แสดง popup หลัง delay เล็กน้อย
    const t = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(t);
  }, []);

  // ปิดชั่วโมง — เก็บ timestamp 1 ชั่วโมงข้างหน้า
  const handleSnooze = useCallback(() => {
    setVisible(false);
    try {
      const until = Date.now() + SNOOZE_DURATION;
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {
      // ignore
    }
    setSnoozed(true);
  }, []);

  // ปิดชั่วคราว (X) — ถ้ารีเฟรชจะขึ้นใหม่
  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  // ไปยังรายการถัดไป
  const handleNext = useCallback(() => {
    setCurrent((c) => (c + 1) % items.length);
  }, [items.length]);

  // ไปยังรายการก่อนหน้า
  const handlePrev = useCallback(() => {
    setCurrent((c) => (c - 1 + items.length) % items.length);
  }, [items.length]);

  // ไม่แสดงถ้า snooze หรือไม่มีรายการ
  if (snoozed || items.length === 0) return null;
  if (!visible) return null;

  const item = items[Math.min(current, items.length - 1)];

  const typeConfig: Record<string, { icon: string; color: string; bg: string }> = {
    notice: { icon: "info", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10" },
    news: { icon: "newspaper", color: "text-meb-green", bg: "bg-meb-light/50 dark:bg-meb-green/10" },
    alert: { icon: "warning", color: "text-price-red", bg: "bg-red-50 dark:bg-red-500/10" },
  };
  const cfg = typeConfig[item.type] ?? typeConfig.notice;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
        onClick={handleClose}
      />

      {/* Modal — กลางจอ */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg max-h-[85vh] bg-white dark:bg-card-bg rounded-2xl shadow-2xl border border-gray-100 dark:border-border-base overflow-hidden animate-[scaleIn_200ms_ease-out] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — แถบสี + ปุ่มปิด */}
          <div className={`flex items-center justify-between px-5 py-3 ${cfg.bg}`}>
            <div className="flex items-center gap-2">
              <PhosphorIcon name={cfg.icon} weight="fill" className={`text-lg ${cfg.color}`} />
              <span className={`text-sm font-bold ${cfg.color}`}>
                {item.type === "alert" ? "แจ้งเตือน" : item.type === "news" ? "ข่าวสาร" : "ประกาศ"}
              </span>
              {item.is_pinned && (
                <PhosphorIcon name="push-pin" weight="fill" className="text-xs text-amber-500" />
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* ปุ่มปิด 1 ชั่วโมง */}
              <button
                onClick={handleSnooze}
                className="text-xs font-medium text-slate-500 hover:text-meb-green dark:text-slate-400 hover:bg-meb-light/30 px-2.5 py-1 rounded-md transition flex items-center gap-1"
                title="ไม่แสดงอีก 1 ชั่วโมง"
              >
                <PhosphorIcon name="clock" className="text-sm" />
                ปิด 1 ชม.
              </button>
              {/* ปุ่ม X ปิด */}
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition p-1"
                aria-label="ปิด"
              >
                <PhosphorIcon name="x" weight="bold" className="text-lg" />
              </button>
            </div>
          </div>

          {/* เนื้อหา — เลื่อนได้ */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* รูปภาพ (ถ้ามี) */}
            {item.image_url && (
              <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 dark:border-border-base">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full max-h-64 object-cover"
                />
              </div>
            )}

            <h3 className="font-bold text-lg text-forest dark:text-slate-100 mb-2">
              {item.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
              {item.body}
            </p>

            {/* action button (ถ้ามี) */}
            {item.action_url && item.action_label && (
              <a
                href={item.action_url}
                onClick={handleClose}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-5 py-2.5 rounded-lg transition-colors"
              >
                {item.action_label}
                <PhosphorIcon name="arrow-right" weight="bold" className="text-sm" />
              </a>
            )}
          </div>

          {/* Footer — ปุ่มเลื่อน + จุด (ถ้ามีหลายรายการ) */}
          {items.length > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-border-base">
              {/* ปุ่มก่อนหน้า */}
              <button
                onClick={handlePrev}
                className="p-1.5 text-slate-400 hover:text-meb-green transition rounded-md hover:bg-meb-light/30"
                aria-label="ก่อนหน้า"
              >
                <PhosphorIcon name="caret-left" weight="bold" className="text-lg" />
              </button>

              {/* จุดนำทาง */}
              <div className="flex items-center gap-1.5">
                {items.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setCurrent(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === current
                        ? "w-6 bg-meb-green"
                        : "w-2 bg-slate-300 dark:bg-white/20 hover:bg-slate-400"
                    }`}
                    aria-label={`ประกาศที่ ${i + 1}`}
                  />
                ))}
              </div>

              {/* ปุ่มถัดไป */}
              <button
                onClick={handleNext}
                className="p-1.5 text-slate-400 hover:text-meb-green transition rounded-md hover:bg-meb-light/30"
                aria-label="ถัดไป"
              >
                <PhosphorIcon name="caret-right" weight="bold" className="text-lg" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}