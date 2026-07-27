"use client";

import { useState, useEffect } from "react";
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
 * AnnouncementPopup — popup ประกาศบนหน้าแรก
 * - แสดง popup ที่มุมขวาล่าง (fixed)
 * - ปุ่ม X ปิด → เก็บ dismissed ID ใน localStorage (ไม่แสดงซ้ำในเครื่องนี้)
 * - มีหลายรายการ → เลื่อนด้วยปุ่ม prev/next หรือจุด
 * - action button (ถ้ามี)
 * - slide-in animation จากขวา
 */
export function AnnouncementPopup({ items }: { items: HomeAnnouncement[] }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);

  // โหลด dismissed IDs จาก localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("announcements_dismissed");
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        setDismissed(ids);
      }
    } catch {
      // localStorage ไม่ available (SSR) → ข้าม
    }
    // แสดง popup หลัง delay เล็กน้อยเพื่อให้หน้าโหลดเสร็จก่อน
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  // กรองรายการที่ยังไม่ถูก dismissed
  const activeItems = items.filter((a) => !dismissed.includes(a.id));

  // ถ้าไม่เหลือรายการ → ไม่แสดง
  useEffect(() => {
    if (activeItems.length === 0) {
      setVisible(false);
    }
  }, [activeItems.length]);

  // รีเซ็ต current index ถ้าเกินขอบเขต
  useEffect(() => {
    if (current >= activeItems.length) {
      setCurrent(0);
    }
  }, [current, activeItems.length]);

  if (activeItems.length === 0) return null;

  const item = activeItems[Math.min(current, activeItems.length - 1)];

  // ปิด popup ปัจจุบัน → เก็บ ID ลง localStorage
  function handleDismiss() {
    setVisible(false);
    const id = item.id;
    setDismissed((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem("announcements_dismissed", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    // ไปยังรายการถัดไป (ถ้ามี) หลัง animation
    setTimeout(() => {
      if (activeItems.length > 1) {
        setCurrent((c) => Math.min(c, activeItems.length - 2));
        setVisible(true);
      }
    }, 400);
  }

  const typeConfig: Record<string, { icon: string; color: string }> = {
    notice: { icon: "info", color: "text-blue-600" },
    news: { icon: "newspaper", color: "text-meb-green" },
    alert: { icon: "warning", color: "text-price-red" },
  };
  const cfg = typeConfig[item.type] ?? typeConfig.notice;

  return (
    <>
      {/* Backdrop (คลิกเพื่อปิด) — semi-transparent */}
      {visible && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
          onClick={handleDismiss}
        />
      )}

      {/* Popup */}
      <div
        className={`fixed bottom-4 right-4 z-[61] w-[calc(100vw-2rem)] max-w-sm transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-white dark:bg-card-bg rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-border-base overflow-hidden">
          {/* แถบสีบนสุด + ปุ่มปิด */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-meb-light/50 dark:bg-meb-green/10">
            <div className="flex items-center gap-1.5 text-meb-green">
              <PhosphorIcon name={cfg.icon} weight="fill" className="text-base" />
              <span className="text-xs font-bold">
                {item.type === "alert" ? "แจ้งเตือน" : item.type === "news" ? "ข่าวสาร" : "ประกาศ"}
              </span>
              {item.is_pinned && (
                <PhosphorIcon name="push-pin" weight="fill" className="text-xs text-amber-500 ml-1" />
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
              aria-label="ปิด"
            >
              <PhosphorIcon name="x" weight="bold" className="text-base" />
            </button>
          </div>

          {/* เนื้อหา */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {/* รูปภาพ (ถ้ามี) */}
            {item.image_url && (
              <div className="mb-3 rounded-lg overflow-hidden border border-gray-200 dark:border-border-base">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full max-h-48 object-cover"
                />
              </div>
            )}

            <h3 className="font-bold text-sm text-forest dark:text-slate-100 mb-1.5">
              {item.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
              {item.body}
            </p>

            {/* action button (ถ้ามี) */}
            {item.action_url && item.action_label && (
              <a
                href={item.action_url}
                onClick={handleDismiss}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-4 py-2 rounded-lg transition-colors"
              >
                {item.action_label}
                <PhosphorIcon name="arrow-right" weight="bold" className="text-sm" />
              </a>
            )}
          </div>

          {/* จุดนำทาง (ถ้ามีหลายรายการ) */}
          {activeItems.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pb-3">
              {activeItems.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === Math.min(current, activeItems.length - 1)
                      ? "w-5 bg-meb-green"
                      : "w-1.5 bg-slate-300 dark:bg-white/20 hover:bg-slate-400"
                  }`}
                  aria-label={`ไปยังรายการที่ ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}