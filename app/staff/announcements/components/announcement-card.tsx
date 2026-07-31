"use client";

import { useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import type { Announcement } from "../actions";
import {
  togglePinAction,
  toggleActiveAction,
  deleteAnnouncementAction,
} from "../actions";

type AnnouncementCardProps = {
  announcement: Announcement;
  onEdit: () => void;
  onTogglePin: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
};

// แมปสีของ type badge
const TYPE_BADGE: Record<Announcement["type"], { label: string; className: string }> = {
  notice: {
    label: "ประกาศทั่วไป",
    className: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
  news: {
    label: "ข่าวสาร",
    className:
      "bg-meb-light text-meb-green dark:bg-meb-green/10 dark:text-meb-light",
  },
  alert: {
    label: "แจ้งเตือนระบบ",
    className:
      "bg-red-50 text-price-red dark:bg-red-500/10 dark:text-price-red",
  },
};

// แมปสีของ target_audience badge
const TARGET_BADGE: Record<
  Announcement["target_audience"],
  { label: string; className: string }
> = {
  all: {
    label: "ทุกคน",
    className:
      "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  },
  member: {
    label: "สมาชิก",
    className: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
  staff: {
    label: "เจ้าหน้าที่",
    className:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  },
};

/** จัดรูปแบบวันที่เป็นภาษาไทยแบบสั้น */
function formatThaiDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  } catch {
    return iso;
  }
}

/** เช็คว่าประกาศหมดอายุแล้วหรือยัง */
function isExpired(endAt: string | null): boolean {
  if (!endAt) return false;
  return new Date(endAt).getTime() < Date.now();
}

/**
 * AnnouncementCard — การ์ดแสดงประกาศรายตัว พร้อมปุ่มจัดการ
 * ปุ่ม: แก้ไข, ปักหมุด (toggle), เปิด/ปิด (toggle active), ลบ
 */
export function AnnouncementCard({
  announcement,
  onEdit,
  onTogglePin,
  onToggleActive,
  onDelete,
}: AnnouncementCardProps) {
  const [pending, startTransition] = useTransition();
  const typeBadge = TYPE_BADGE[announcement.type];
  const targetBadge = TARGET_BADGE[announcement.target_audience];
  const expired = isExpired(announcement.end_at);

  function handlePin() {
    const fd = new FormData();
    fd.set("id", announcement.id);
    fd.set("is_pinned", String(announcement.is_pinned));
    startTransition(async () => {
      const res = await togglePinAction(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      onTogglePin();
    });
  }

  function handleToggleActive() {
    const fd = new FormData();
    fd.set("id", announcement.id);
    fd.set("is_active", String(announcement.is_active));
    startTransition(async () => {
      const res = await toggleActiveAction(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      onToggleActive();
    });
  }

  function handleDelete() {
    if (!confirm("ต้องการลบประกาศนี้ใช่หรือไม่?")) return;
    const fd = new FormData();
    fd.set("id", announcement.id);
    startTransition(async () => {
      const res = await deleteAnnouncementAction(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      onDelete();
    });
  }

  return (
    <div
      className={`relative bg-white dark:bg-card-bg rounded-xl border p-4 transition-colors ${
        announcement.is_active
          ? "border-gray-100 dark:border-border-base"
          : "border-gray-200 dark:border-border-base opacity-60"
      }`}
    >
      {/* แถวบน: badge + ปุ่มปักหมุด */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {announcement.is_pinned && (
            <span
              className="inline-flex items-center text-amber-500"
              title="ปักหมุด"
            >
              <PhosphorIcon name="push-pin" weight="fill" className="text-base" />
            </span>
          )}
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${typeBadge.className}`}
          >
            {typeBadge.label}
          </span>
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${targetBadge.className}`}
          >
            {targetBadge.label}
          </span>
          {!announcement.is_active && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-slate-400">
              ปิดใช้งาน
            </span>
          )}
          {announcement.show_on_homepage && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-meb-light text-meb-green dark:bg-meb-green/10 dark:text-meb-light">
              หน้าแรก
            </span>
          )}
          {expired ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-price-red dark:bg-red-500/10 dark:text-price-red">
              หมดอายุ {announcement.end_at && formatThaiDate(announcement.end_at)}
            </span>
          ) : announcement.end_at ? (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400">
              หมดอายุ {formatThaiDate(announcement.end_at)}
            </span>
          ) : null}
        </div>
      </div>

      {/* หัวข้อ + รูป (ถ้ามี) + เนื้อหา (ตัด 2 บรรทัด) */}
      <h3 className="font-bold text-sm text-forest dark:text-slate-100 mb-1">
        {announcement.title}
      </h3>
      {announcement.image_url && (
        <div className="mb-2 rounded-lg overflow-hidden border border-gray-200 dark:border-border-base">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={announcement.image_url}
            alt={announcement.title}
            className="w-full max-h-40 object-cover"
          />
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 whitespace-pre-wrap">
        {announcement.body}
      </p>

      {/* action label + url (ถ้ามี) */}
      {announcement.action_label && announcement.action_url && (
        <div className="flex items-center gap-1.5 text-xs text-meb-green mb-2">
          <PhosphorIcon name="arrow-right" weight="bold" className="text-sm" />
          <span className="font-medium">{announcement.action_label}</span>
          <span className="text-slate-400 dark:text-slate-500 truncate">
            {announcement.action_url}
          </span>
        </div>
      )}

      {/* แถวล่าง: วันที่ + ปุ่มจัดการ */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-border-base">
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {formatThaiDate(announcement.created_at)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            disabled={pending}
            title="แก้ไข"
            className="p-1.5 rounded-md text-slate-500 hover:text-meb-green hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-white/10 transition disabled:opacity-60 cursor-pointer"
          >
            <PhosphorIcon name="pencil-simple" className="text-base" />
          </button>
          <button
            onClick={handlePin}
            disabled={pending}
            title={announcement.is_pinned ? "ยกเลิกปักหมุด" : "ปักหมุด"}
            className={`p-1.5 rounded-md transition disabled:opacity-60 cursor-pointer ${
              announcement.is_pinned
                ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                : "text-slate-500 hover:text-amber-500 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-white/10"
            }`}
          >
            <PhosphorIcon
              name="push-pin"
              weight={announcement.is_pinned ? "fill" : "regular"}
              className="text-base"
            />
          </button>
          <button
            onClick={handleToggleActive}
            disabled={pending}
            title={announcement.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            className="p-1.5 rounded-md text-slate-500 hover:text-meb-green hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-white/10 transition disabled:opacity-60 cursor-pointer"
          >
            <PhosphorIcon
              name={announcement.is_active ? "eye" : "eye-slash"}
              className="text-base"
            />
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            title="ลบ"
            className="p-1.5 rounded-md text-slate-500 hover:text-price-red hover:bg-red-50 dark:text-slate-400 dark:hover:bg-red-500/10 transition disabled:opacity-60 cursor-pointer"
          >
            <PhosphorIcon name="trash" className="text-base" />
          </button>
        </div>
      </div>
    </div>
  );
}