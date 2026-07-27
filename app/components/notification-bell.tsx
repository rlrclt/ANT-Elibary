"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { PhosphorIcon } from "./phosphor-icon";
import {
  getMyAnnouncementsAction,
  markAsReadAction,
  getUnreadCountAction,
  type BellAnnouncement,
  type SystemNotification,
  type VirtualNotification,
} from "./notification-bell-actions";

/**
 * NotificationBell — ปุ่มกระดิ่ง + popup 2 tabs (แจ้งเตือน/ข่าวสาร)
 *
 * Tab "แจ้งเตือนระบบ": รวม 3 แหล่ง
 *   1. announcements type='alert' (แอดมินสร้าง, มี schedule/หมดอายุ)
 *   2. system_notifications (DB trigger สร้างอัตโนมัติ: ยืม/คืน/access/account)
 *   3. virtual notifications (คำนวณตอนโหลด: ใกล้ครบกำหนด/เกินกำหนด)
 *
 * Tab "ฟีดข่าวสาร": announcements type='notice' + 'news' (มีรูป + ดูเพิ่มเติม)
 *
 * - แสดง unread count บนกระดิ่ง (รวมทั้งหมด)
 * - คลิกนอก popup → ปิดอัตโนมัติ
 * - คลิก item → mark as read
 * - คลิก "ดูเพิ่มเติม" → slide-in detail view (translate-x)
 */

/** จัดรูปแบบเวลาแบบสั้นภาษาไทย */
function formatRelativeTime(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "เมื่อสักครู่";
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay} วันที่แล้ว`;
    const d = new Date(iso);
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return iso;
  }
}

/** จัดรูปแบบวันที่เต็มภาษาไทย */
function formatFullDate(iso: string): string {
  try {
    const d = new Date(iso);
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return iso;
  }
}

/** เช็คว่าประกาศหมดอายุแล้วหรือยัง */
function isExpired(endAt: string | null): boolean {
  if (!endAt) return false;
  return new Date(endAt).getTime() < Date.now();
}

/** รวม alerts + systemAlerts เป็น list เดียวสำหรับ tab แจ้งเตือนระบบ */
type AlertItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  // สำหรับ announcement alert
  end_at?: string | null;
  action_label?: string | null;
  action_url?: string | null;
  image_url?: string | null;
  kind: "announcement" | "system" | "virtual";
  icon?: string;
  event_type?: string;
  category?: string;
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notifications" | "news">(
    "notifications",
  );
  const [alerts, setAlerts] = useState<BellAnnouncement[]>([]);
  const [news, setNews] = useState<BellAnnouncement[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<
    (SystemNotification | VirtualNotification)[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNews, setSelectedNews] = useState<BellAnnouncement | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const popupRef = useRef<HTMLDivElement>(null);

  // โหลดข้อมูลครั้งแรก
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [annRes, countRes] = await Promise.all([
        getMyAnnouncementsAction(),
        getUnreadCountAction(),
      ]);
      if (cancelled) return;
      if (annRes.data) {
        setAlerts(annRes.data.alerts);
        setNews(annRes.data.news);
        setSystemAlerts(annRes.data.systemAlerts);
      }
      if (typeof countRes.data === "number") setUnreadCount(countRes.data);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ปิด popup เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // รีเซ็ต selectedNews หลังปิด popup 300ms (รอ animation)
  useEffect(() => {
    if (isOpen) return;
    const t = setTimeout(() => setSelectedNews(null), 300);
    return () => clearTimeout(t);
  }, [isOpen]);

  // mark as read สำหรับ announcement alert
  function handleMarkReadAnn(item: BellAnnouncement) {
    if (item.read) return;
    setAlerts((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, read: true } : a)),
    );
    setNews((prev) => prev.map((a) => (a.id === item.id ? { ...a, read: true } : a)));
    setUnreadCount((c) => Math.max(0, c - 1));

    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("kind", "announcement");
    startTransition(async () => {
      await markAsReadAction(fd);
    });
  }

  // mark as read สำหรับ system notification (ไม่ mark virtual เพราะไม่ได้เก็บใน DB)
  function handleMarkReadSys(item: SystemNotification | VirtualNotification) {
    // virtual → ไม่มี DB record ไม่ต้อง mark
    if (item.id.startsWith("virtual-")) return;
    const sys = item as SystemNotification;
    if (sys.is_read) return;
    setSystemAlerts((prev) =>
      prev.map((a) =>
        a.id === sys.id ? { ...a, is_read: true } : a,
      ) as (SystemNotification | VirtualNotification)[],
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    const fd = new FormData();
    fd.set("id", sys.id);
    fd.set("kind", "system");
    startTransition(async () => {
      await markAsReadAction(fd);
    });
  }

  const hasUnread = unreadCount > 0;
  const isDetailOpen = selectedNews !== null;

  // รวม alerts (announcement type=alert) + systemAlerts เป็น list เดียว
  // เรียง: virtual overdue → system ล่าสุด → announcement alert
  const alertList: AlertItem[] = [
    ...systemAlerts
      .filter((s) => "event_type" in s && s.event_type === "overdue")
      .map((s) => ({
        id: s.id,
        title: s.title,
        body: s.body,
        created_at: s.created_at,
        read: (s as any).is_read ?? false,
        kind: (s.id.startsWith("virtual-") ? "virtual" : "system") as AlertItem["kind"],
        icon: (s as any).icon,
        event_type: (s as any).event_type,
        category: (s as any).category,
        action_url: (s as any).action_url ?? null,
      })),
    ...alerts.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      created_at: a.created_at,
      read: a.read,
      kind: "announcement" as const,
      end_at: a.end_at,
      action_label: a.action_label,
      action_url: a.action_url,
      image_url: a.image_url,
    })),
    ...systemAlerts
      .filter((s) => !("event_type" in s) || (s as any).event_type !== "overdue")
      .map((s) => ({
        id: s.id,
        title: s.title,
        body: s.body,
        created_at: s.created_at,
        read: (s as any).is_read ?? false,
        kind: (s.id.startsWith("virtual-") ? "virtual" : "system") as AlertItem["kind"],
        icon: (s as any).icon,
        event_type: (s as any).event_type,
        category: (s as any).category,
        action_url: (s as any).action_url ?? null,
      })),
  ];

  // สร้าง action button สำหรับ detail view
  function renderActionButton(item: BellAnnouncement) {
    if (!item.action_url) return null;
    return (
      <a
        href={item.action_url}
        onClick={() => handleMarkReadAnn(item)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-white bg-meb-green px-4 py-2 rounded-lg hover:bg-meb-green/90 transition-colors"
      >
        {item.action_label || "ดูรายละเอียด"}
        <PhosphorIcon name="arrow-right" weight="bold" className="text-sm" />
      </a>
    );
  }

  // ไอคอนสำหรับ system/virtual notification ตาม icon field
  function getSysIcon(item: AlertItem): string {
    if (item.kind === "virtual" && item.event_type === "overdue")
      return "warning-circle";
    if (item.kind === "virtual" && item.event_type === "due_soon")
      return "clock";
    return item.icon || "bell";
  }

  // แสดง item ใน tab แจ้งเตือนระบบ
  function renderAlertRow(item: AlertItem) {
    const isAnn = item.kind === "announcement";
    const expired = isAnn ? isExpired(item.end_at ?? null) : false;
    const sysItem = !isAnn ? (systemAlerts.find((s) => s.id === item.id) as SystemNotification | VirtualNotification | undefined) : undefined;

    return (
      <div
        key={item.id}
        onClick={() => {
          if (isAnn) {
            handleMarkReadAnn(item as BellAnnouncement & AlertItem);
          } else if (sysItem) {
            handleMarkReadSys(sysItem);
          }
        }}
        className={`p-3 mb-1 rounded-xl cursor-pointer transition-colors flex items-start gap-2.5 ${
          item.read
            ? "hover:bg-slate-50 dark:hover:bg-white/5"
            : "bg-meb-light/50 dark:bg-meb-green/5"
        }`}
      >
        {/* ไอคอน */}
        <div
          className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center mt-0.5 ${
            item.read
              ? "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500"
              : item.kind === "virtual" && item.event_type === "overdue"
                ? "bg-red-50 text-price-red dark:bg-red-500/10"
                : "bg-meb-light text-meb-green dark:bg-meb-green/10"
          }`}
        >
          <PhosphorIcon name={getSysIcon(item)} weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm ${
              item.read
                ? "text-slate-600 dark:text-slate-400"
                : "font-bold text-slate-800 dark:text-slate-100"
            }`}
          >
            {item.title}
          </p>
          {expired && isAnn && (
            <span className="inline-block text-[10px] font-bold text-price-red bg-red-50 dark:bg-red-500/10 dark:text-price-red px-1.5 py-0.5 rounded-full mt-0.5">
              หมดอายุตั้งแต่ {item.end_at && formatFullDate(item.end_at)}
            </span>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {item.body}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {formatRelativeTime(item.created_at)}
            </span>
            {!item.read && (
              <span className="w-2 h-2 rounded-full bg-meb-green shrink-0" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // แสดง item ใน tab ฟีดข่าวสาร — รูป + title + excerpt + ปุ่มดูเพิ่มเติม
  function renderNewsItem(item: BellAnnouncement) {
    const expired = isExpired(item.end_at);
    return (
      <div
        key={item.id}
        onClick={() => handleMarkReadAnn(item)}
        className={`p-3 mb-1 rounded-xl cursor-pointer transition-colors ${
          item.read
            ? "hover:bg-slate-50 dark:hover:bg-white/5"
            : "bg-meb-light/50 dark:bg-meb-green/5"
        }`}
      >
        <div className="flex gap-2.5">
          {item.image_url && (
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-border-base shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm line-clamp-1 ${
                item.read
                  ? "text-slate-600 dark:text-slate-400"
                  : "font-bold text-slate-800 dark:text-slate-100"
              }`}
            >
              {item.title}
            </p>
            {expired && (
              <span className="inline-block text-[10px] font-bold text-price-red bg-red-50 dark:bg-red-500/10 dark:text-price-red px-1.5 py-0.5 rounded-full mt-0.5">
                หมดอายุตั้งแต่ {item.end_at && formatFullDate(item.end_at)}
              </span>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
              {item.body}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {formatRelativeTime(item.created_at)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkReadAnn(item);
                  setSelectedNews(item);
                }}
                className="text-[11px] font-bold text-meb-green hover:underline flex items-center gap-0.5"
              >
                ดูเพิ่มเติม
                <PhosphorIcon name="caret-right" weight="bold" className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={popupRef}>
      {/* 1. ปุ่มกระดิ่ง */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center text-2xl text-white hover:text-meb-light transition-colors focus:outline-none rounded"
        aria-label="แจ้งเตือน"
      >
        <PhosphorIcon name="bell" weight={isOpen ? "fill" : "regular"} />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-price-red text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-meb-green">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 2. หน้าต่าง Popup */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-card-bg rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-border-base overflow-hidden z-50">
          {/* คอนเทนเนอร์ relative สำหรับ slide-in views */}
          <div className="relative w-full h-[450px] overflow-hidden">
            {/* --- VIEW 1: หน้ารายการ --- */}
            <div
              className={`absolute inset-0 w-full h-full flex flex-col transition-transform duration-300 ${
                isDetailOpen ? "-translate-x-full" : "translate-x-0"
              }`}
            >
              {/* Header & Tabs */}
              <div className="pt-4 px-4 bg-white dark:bg-card-bg shrink-0 border-b border-slate-100 dark:border-border-base">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-3">
                  การแจ้งเตือน
                </h3>
                <div className="flex">
                  <button
                    onClick={() => setActiveTab("notifications")}
                    className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${
                      activeTab === "notifications"
                        ? "border-meb-green text-meb-green"
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    แจ้งเตือนระบบ
                  </button>
                  <button
                    onClick={() => setActiveTab("news")}
                    className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${
                      activeTab === "news"
                        ? "border-meb-green text-meb-green"
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    ฟีดข่าวสาร
                  </button>
                </div>
              </div>

              {/* Content Scroll Area */}
              <div className="flex-1 overflow-y-auto p-2">
                {pending &&
                alerts.length === 0 &&
                news.length === 0 &&
                systemAlerts.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                    <PhosphorIcon
                      name="circle-notch"
                      className="text-2xl animate-spin mr-2"
                    />
                    <span className="text-sm">กำลังโหลด...</span>
                  </div>
                ) : activeTab === "notifications" ? (
                  alertList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                        <PhosphorIcon name="bell-slash" className="text-2xl" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ไม่มีการแจ้งเตือน
                      </p>
                    </div>
                  ) : (
                    alertList.map(renderAlertRow)
                  )
                ) : news.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                      <PhosphorIcon name="newspaper" className="text-2xl" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ยังไม่มีข่าวสาร
                    </p>
                  </div>
                ) : (
                  news.map(renderNewsItem)
                )}
              </div>
            </div>

            {/* --- VIEW 2: หน้ารายละเอียดข่าว (slide-in) --- */}
            <div
              className={`absolute inset-0 w-full h-full flex flex-col bg-white dark:bg-card-bg transition-transform duration-300 ${
                isDetailOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {/* Back Header */}
              <div className="pt-4 px-4 pb-3 shrink-0 border-b border-slate-100 dark:border-border-base flex items-center gap-2">
                <button
                  onClick={() => setSelectedNews(null)}
                  className="flex items-center gap-1 text-sm font-bold text-meb-green hover:underline"
                >
                  <PhosphorIcon name="arrow-left" weight="bold" className="text-base" />
                  ย้อนกลับ
                </button>
              </div>

              {/* Detail Scroll Area */}
              {selectedNews && (
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedNews.image_url && (
                    <div className="w-full h-40 rounded-xl overflow-hidden border border-gray-200 dark:border-border-base mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedNews.image_url}
                        alt={selectedNews.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                    {selectedNews.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 mb-3">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatFullDate(selectedNews.created_at)}
                    </span>
                    {isExpired(selectedNews.end_at) && (
                      <span className="text-[10px] font-bold text-price-red bg-red-50 dark:bg-red-500/10 dark:text-price-red px-1.5 py-0.5 rounded-full">
                        หมดอายุตั้งแต่ {selectedNews.end_at && formatFullDate(selectedNews.end_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedNews.body}
                  </p>
                  {renderActionButton(selectedNews)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}