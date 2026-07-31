"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  getAnnouncementsAction,
  type Announcement,
} from "../actions";
import { AnnouncementCard } from "./announcement-card";
import { AnnouncementFormModal } from "./announcement-form-modal";

type AnnouncementsClientProps = {
  initialAnnouncements: Announcement[];
};

/**
 * AnnouncementsClient — client-side controller สำหรับ /staff/announcements
 * จัดการ state: filter, search, modal สร้าง/แก้ไข, refresh ข้อมูล
 */
export function AnnouncementsClient({
  initialAnnouncements,
}: AnnouncementsClientProps) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "notice" | "news" | "alert">(
    "all",
  );
  const [targetFilter, setTargetFilter] = useState<"all" | "member" | "staff">(
    "all",
  );
  const [pending, startTransition] = useTransition();

  // modal สร้าง/แก้ไข
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  function refresh() {
    startTransition(async () => {
      const result = await getAnnouncementsAction({
        type: typeFilter,
        target: targetFilter,
        search: search || undefined,
      });
      if (result.data) setAnnouncements(result.data);
    });
  }

  function handleSearch() {
    refresh();
  }

  function handleTypeChange(v: "all" | "notice" | "news" | "alert") {
    setTypeFilter(v);
    startTransition(async () => {
      const result = await getAnnouncementsAction({
        type: v,
        target: targetFilter,
        search: search || undefined,
      });
      if (result.data) setAnnouncements(result.data);
    });
  }

  function handleTargetChange(v: "all" | "member" | "staff") {
    setTargetFilter(v);
    startTransition(async () => {
      const result = await getAnnouncementsAction({
        type: typeFilter,
        target: v,
        search: search || undefined,
      });
      if (result.data) setAnnouncements(result.data);
    });
  }

  function handleCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleEdit(a: Announcement) {
    setEditing(a);
    setModalOpen(true);
  }

  // หลัง toggle/delete: re-fetch เพื่อให้ state สดใหม่
  function handleLocalChange() {
    refresh();
  }

  return (
    <>
      {/* Header + Filter */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {/* หัวข้อ + ปุ่มสร้าง */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Link
              href="/staff"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-meb-green hover:bg-gray-100 dark:text-slate-400 dark:hover:text-meb-green dark:hover:bg-white/10 transition-all duration-200"
              title="ย้อนกลับไปหน้าเจ้าหน้าที่"
            >
              <PhosphorIcon name="arrow-left" className="text-xl" weight="bold" />
            </Link>
            <PhosphorIcon name="megaphone" weight="fill" className="text-2xl text-meb-green" />
            <h1 className="text-lg md:text-xl font-bold text-forest dark:text-slate-100">
              จัดการประกาศ
            </h1>
          </div>
          <button
            onClick={handleCreate}
            className="btn-cta inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover rounded-md shadow-sm cursor-pointer"
          >
            <PhosphorIcon name="plus" weight="bold" />
            สร้างประกาศ
          </button>
        </div>

        {/* Filter toolbar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <PhosphorIcon
              name="magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="ค้นหาจากหัวข้อหรือเนื้อหา..."
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light dark:text-slate-100"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) =>
              handleTypeChange(e.target.value as "all" | "notice" | "news" | "alert")
            }
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100 shrink-0"
          >
            <option value="all">ทุกประเภท</option>
            <option value="notice">ประกาศทั่วไป</option>
            <option value="news">ข่าวสาร</option>
            <option value="alert">แจ้งเตือนระบบ</option>
          </select>
          <select
            value={targetFilter}
            onChange={(e) =>
              handleTargetChange(e.target.value as "all" | "member" | "staff")
            }
            className="px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green dark:text-slate-100 shrink-0"
          >
            <option value="all">ทุกกลุ่มเป้าหมาย</option>
            <option value="member">สมาชิก</option>
            <option value="staff">เจ้าหน้าที่</option>
          </select>
        </div>
      </section>

      {/* รายการประกาศ */}
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 transition-colors">
        {pending ? (
          <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <PhosphorIcon name="circle-notch" className="text-3xl animate-spin mr-2" />
            <span className="text-sm">กำลังโหลด...</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
              <PhosphorIcon name="megaphone" weight="regular" className="text-3xl" />
            </div>
            <h3 className="text-sm font-bold text-forest dark:text-slate-100 mb-1">
              ยังไม่มีประกาศ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กดปุ่ม &quot;สร้างประกาศ&quot; เพื่อเพิ่มประกาศใหม่
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {announcements.map((a) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                onEdit={() => handleEdit(a)}
                onTogglePin={handleLocalChange}
                onToggleActive={handleLocalChange}
                onDelete={handleLocalChange}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal สร้าง/แก้ไข */}
      <AnnouncementFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        announcement={editing}
      />
    </>
  );
}