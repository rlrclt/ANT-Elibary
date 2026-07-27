"use client";

import { useState, useTransition, useEffect } from "react";
import { Modal } from "../../../components/modal";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  type Announcement,
} from "../actions";

type AnnouncementFormModalProps = {
  open: boolean;
  onClose: () => void;
  announcement?: Announcement | null;
};

/** แปลง ISO string → ค่าที่ใช้ใน <input type="datetime-local"> (YYYY-MM-DDTHH:mm) */
function toLocalInputValue(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

/**
 * AnnouncementFormModal — ฟอร์มสร้าง/แก้ไขประกาศ
 * - ถ้ามี announcement → โหมดแก้ไข (เติมค่าเดิม)
 * - ถ้าไม่มี → โหมดสร้างใหม่
 */
export function AnnouncementFormModal({
  open,
  onClose,
  announcement,
}: AnnouncementFormModalProps) {
  const isEdit = !!announcement;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // รีเซ็ต state ทุกครั้งที่เปิด modal
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    if (isEdit && announcement) {
      formData.set("id", announcement.id);
    }

    startTransition(async () => {
      const res = isEdit
        ? await updateAnnouncementAction(formData)
        : await createAnnouncementAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "แก้ไขประกาศ" : "สร้างประกาศใหม่"}
      description={
        isEdit
          ? "แก้ไขเนื้อหาประกาศที่มีอยู่"
          : "เพิ่มประกาศ/ข่าวสาร/แจ้งเตือนระบบใหม่"
      }
      size="lg"
    >
      {success ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-meb-light text-meb-green rounded-full flex items-center justify-center text-3xl mb-4 animate-bounce">
            <PhosphorIcon name="check-circle" weight="fill" />
          </div>
          <h3 className="text-lg font-bold text-forest dark:text-slate-100 mb-1">
            {isEdit ? "บันทึกการแก้ไขสำเร็จ!" : "สร้างประกาศสำเร็จ!"}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ระบบได้อัปเดตข้อมูลเรียบร้อยแล้ว
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-lg text-sm bg-red-50 dark:bg-red-500/10 text-price-red">
              <PhosphorIcon name="warning" weight="fill" className="text-lg" />
              <span>{error}</span>
            </div>
          )}

          {/* หัวข้อ */}
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              หัวข้อ <span className="text-terracotta">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              maxLength={200}
              defaultValue={announcement?.title ?? ""}
              placeholder="เช่น ปิดระบบชั่วคราวเพื่อบำรุงรักษา"
              className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            />
          </div>

          {/* รายละเอียด */}
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              รายละเอียด <span className="text-terracotta">*</span>
            </label>
            <textarea
              name="body"
              required
              rows={4}
              defaultValue={announcement?.body ?? ""}
              placeholder="กรอกรายละเอียดประกาศ..."
              className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 resize-none"
            />
          </div>

          {/* ประเภท + กลุ่มเป้าหมาย */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                ประเภท
              </label>
              <select
                name="type"
                defaultValue={announcement?.type ?? "notice"}
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              >
                <option value="notice">ประกาศทั่วไป</option>
                <option value="news">ข่าวสาร</option>
                <option value="alert">แจ้งเตือนระบบ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                กลุ่มเป้าหมาย
              </label>
              <select
                name="target_audience"
                defaultValue={announcement?.target_audience ?? "all"}
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              >
                <option value="all">ทุกคน</option>
                <option value="member">สมาชิก</option>
                <option value="staff">เจ้าหน้าที่</option>
              </select>
            </div>
          </div>

          {/* action label + url */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                ป้ายปุ่ม action (ไม่ระบุก็ได้)
              </label>
              <input
                name="action_label"
                type="text"
                maxLength={50}
                defaultValue={announcement?.action_label ?? ""}
                placeholder="เช่น ตรวจสอบ"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                URL ปลายทาง (ไม่ระบุก็ได้)
              </label>
              <input
                name="action_url"
                type="text"
                maxLength={200}
                defaultValue={announcement?.action_url ?? ""}
                placeholder="เช่น /member/loans"
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
          </div>

          {/* รูปภาพ */}
          <div>
            <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
              URL รูปภาพ (ไม่ระบุก็ได้)
            </label>
            <input
              name="image_url"
              type="text"
              defaultValue={announcement?.image_url ?? ""}
              placeholder="https://... (รูปประกอบประกาศ)"
              className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
            />
          </div>

          {/* ระยะเวลาประกาศ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                เริ่มแสดง (ไม่ระบุ = ทันที)
              </label>
              <input
                name="start_at"
                type="datetime-local"
                defaultValue={announcement?.start_at ? toLocalInputValue(announcement.start_at) : ""}
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
                หมดอายุ (ไม่ระบุ = ไม่หมดอายุ)
              </label>
              <input
                name="end_at"
                type="datetime-local"
                defaultValue={announcement?.end_at ? toLocalInputValue(announcement.end_at) : ""}
                className="w-full pl-3 pr-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
            </div>
          </div>

          {/* ปักหมุด + แสดงหน้าแรก */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                name="is_pinned"
                type="checkbox"
                defaultChecked={announcement?.is_pinned ?? false}
                className="w-4 h-4 rounded border-gray-300 text-meb-green focus:ring-meb-light cursor-pointer"
              />
              <span className="text-sm text-forest dark:text-slate-100 flex items-center gap-1">
                <PhosphorIcon name="push-pin" weight="fill" className="text-amber-500" />
                ปักหมุดไว้ด้านบน
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                name="show_on_homepage"
                type="checkbox"
                defaultChecked={announcement?.show_on_homepage ?? false}
                className="w-4 h-4 rounded border-gray-300 text-meb-green focus:ring-meb-light cursor-pointer"
              />
              <span className="text-sm text-forest dark:text-slate-100 flex items-center gap-1">
                <PhosphorIcon name="house" weight="fill" className="text-meb-green" />
                แสดง popup บนหน้าแรก
              </span>
            </label>
          </div>

          {/* ปุ่ม */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-border-base shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-border-base transition disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? (
                <PhosphorIcon name="circle-notch" className="animate-spin" />
              ) : (
                <PhosphorIcon name={isEdit ? "check" : "plus"} weight="bold" />
              )}
              {isEdit ? "บันทึกการแก้ไข" : "สร้างประกาศ"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}