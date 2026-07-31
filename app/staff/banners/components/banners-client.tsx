"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  getBannersAction,
  createBannerAction,
  updateBannerAction,
  deleteBannerAction,
  toggleBannerActiveAction,
  reorderBannerAction,
  type Banner,
} from "../actions";

export function BannersClient() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function loadBanners() {
    const res = await getBannersAction();
    if (res.error) {
      setError(res.error);
      return;
    }
    setBanners(res.data);
  }

  useEffect(() => {
    loadBanners();
  }, []);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await createBannerAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("สร้าง banner สำเร็จ");
      setShowForm(false);
      await loadBanners();
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("id", editing.id);

    startTransition(async () => {
      const res = await updateBannerAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("แก้ไข banner สำเร็จ");
      setEditing(null);
      await loadBanners();
    });
  }

  function handleDelete(id: string, title: string) {
    if (!confirm(`ต้องการลบ banner "${title}" ใช่หรือไม่?`)) return;
    setError(null);
    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      const res = await deleteBannerAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      showSuccess("ลบ banner สำเร็จ");
      await loadBanners();
    });
  }

  function handleToggle(id: string, currentActive: boolean) {
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("is_active", String(currentActive));

    startTransition(async () => {
      const res = await toggleBannerActiveAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      await loadBanners();
    });
  }

  function handleReorder(id: string, direction: "up" | "down") {
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("direction", direction);

    startTransition(async () => {
      const res = await reorderBannerAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      await loadBanners();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="image" weight="fill" className="text-meb-green" />
            จัดการ Banner
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            จัดการรูปภาพ banner ที่แสดงในหน้าแรกของสมาชิก
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-4 py-2.5 rounded-md transition"
        >
          <PhosphorIcon name="plus" weight="bold" />
          เพิ่ม Banner
        </button>
      </div>

      {/* Alert */}
      {error && (
        <div className="flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-4 py-3 rounded-md">
          <PhosphorIcon name="warning-circle" weight="fill" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-meb-light/50 border border-meb-green/30 text-meb-hover text-sm px-4 py-3 rounded-md">
          <PhosphorIcon name="check-circle" weight="fill" />
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <BannerForm
          banner={editing}
          pending={pending}
          onSubmit={editing ? handleUpdate : handleCreate}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Banner list */}
      <div className="space-y-3">
        {banners.length === 0 && !showForm ? (
          <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-12 text-center">
            <PhosphorIcon
              name="image"
              weight="fill"
              className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-3"
            />
            <p className="text-sm text-slate-400">ยังไม่มี banner</p>
            <p className="text-xs text-slate-400 mt-1">
              กดปุ่ม "เพิ่ม Banner" เพื่อสร้างใหม่
            </p>
          </div>
        ) : (
          banners.map((banner, index) => (
            <BannerRow
              key={banner.id}
              banner={banner}
              isFirst={index === 0}
              isLast={index === banners.length - 1}
              pending={pending}
              onEdit={() => {
                setEditing(banner);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(banner.id, banner.title)}
              onToggle={() => handleToggle(banner.id, banner.is_active)}
              onReorder={(dir) => handleReorder(banner.id, dir)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------- BannerForm ----------
function BannerForm({
  banner,
  pending,
  onSubmit,
  onCancel,
}: {
  banner: Banner | null;
  pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(banner?.image_url ?? null);
  const [imageLink, setImageLink] = useState(banner?.image_url ?? "");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
      setImageLink(""); // ล้าง URL เพราะเลือกอัปโหลดแทน
    };
    reader.readAsDataURL(file);
  }

  function handleLinkChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageLink(e.target.value);
    if (e.target.value) {
      setPreview(e.target.value); // preview URL
      if (fileRef.current) fileRef.current.value = ""; // ล้างไฟล์
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 shadow-sm space-y-4"
    >
      <h2 className="text-base font-bold text-forest dark:text-slate-100">
        {banner ? "แก้ไข Banner" : "เพิ่ม Banner ใหม่"}
      </h2>

      {/* รูปภาพ */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          รูปภาพ Banner
        </label>
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="w-40 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <PhosphorIcon name="image" weight="fill" className="text-2xl" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              name="image"
              className="hidden"
              id="banner-image"
            />
            <label
              htmlFor="banner-image"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-meb-green bg-meb-light hover:bg-meb-light/70 px-3 py-2 rounded-md transition cursor-pointer"
            >
              <PhosphorIcon name="upload-simple" weight="bold" className="text-sm" />
              {banner?.image_url ? "เปลี่ยนรูป" : "เลือกรูป"}
            </label>
            <p className="text-xs text-slate-400 mt-1.5">
              JPEG, PNG, WebP, GIF (สูงสุด 10MB) — แนะนำขนาด 728×314
            </p>

            {/* หรือกรอก URL */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-border-base">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                หรือกรอก URL รูปภาพ
              </label>
              <input
                type="url"
                name="image_link"
                value={imageLink}
                onChange={handleLinkChange}
                placeholder="https://example.com/banner.jpg"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                ถ้าไม่อัปโหลดไฟล์ สามารถวาง URL รูปภาพได้
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          ชื่อ Banner *
        </label>
        <input
          type="text"
          name="title"
          required
          defaultValue={banner?.title ?? ""}
          placeholder="ชื่อสำหรับจดจำ"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
        />
      </div>

      {/* Badge */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          ป้าย (Badge)
        </label>
        <input
          type="text"
          name="badge"
          defaultValue={banner?.badge ?? ""}
          placeholder="เช่น เปิดเทอมใหม่ 2569"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
        />
      </div>

      {/* Headline */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          หัวข้อ *
        </label>
        <input
          type="text"
          name="headline"
          required
          defaultValue={banner?.headline ?? ""}
          placeholder="ข้อความหลักของ banner"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
        />
      </div>

      {/* Subtitle */}
      <div>
        <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
          ข้อความรอง
        </label>
        <textarea
          name="subtitle"
          rows={2}
          defaultValue={banner?.subtitle ?? ""}
          placeholder="ข้อความอธิบายเพิ่มเติม"
          className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 resize-none"
        />
      </div>

      {/* Action URL + Label */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
            URL เมื่อคลิก (ไม่บังคับ)
          </label>
          <input
            type="text"
            name="action_url"
            defaultValue={banner?.action_url ?? ""}
            placeholder="/member/books หรือ https://..."
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
            ข้อความปุ่ม (ไม่บังคับ)
          </label>
          <input
            type="text"
            name="action_label"
            defaultValue={banner?.action_label ?? ""}
            placeholder="เช่น ดูเพิ่มเติม"
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100"
          />
        </div>
      </div>

      {/* Active */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="is_active"
          value="true"
          defaultChecked={banner?.is_active ?? true}
          id="banner-active"
          className="w-4 h-4 rounded border-gray-300 text-meb-green focus:ring-meb-light"
        />
        <label
          htmlFor="banner-active"
          className="text-sm text-forest dark:text-slate-100"
        >
          เปิดใช้งาน banner นี้
        </label>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-meb-green hover:bg-meb-hover px-5 py-2.5 rounded-md transition disabled:opacity-60"
        >
          <PhosphorIcon name="check" weight="bold" />
          {banner ? "บันทึก" : "สร้าง Banner"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-forest dark:text-slate-400 px-4 py-2.5 rounded-md transition"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

// ---------- BannerRow ----------
function BannerRow({
  banner,
  isFirst,
  isLast,
  pending,
  onEdit,
  onDelete,
  onToggle,
  onReorder,
}: {
  banner: Banner;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onReorder: (dir: "up" | "down") => void;
}) {
  return (
    <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-4 shadow-sm flex items-center gap-4">
      {/* รูป */}
      <div className="w-28 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0">
        {banner.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <PhosphorIcon name="image" weight="fill" className="text-lg" />
          </div>
        )}
      </div>

      {/* ข้อมูล */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-forest dark:text-slate-100 truncate">
            {banner.title}
          </h3>
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-bold ${
              banner.is_active
                ? "bg-meb-light text-meb-green"
                : "bg-gray-100 dark:bg-slate-700 text-slate-400"
            }`}
          >
            {banner.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {banner.headline}
        </p>
        {banner.badge && (
          <span className="inline-block mt-1 text-[10px] font-bold text-meb-green bg-meb-light px-2 py-0.5 rounded-full">
            {banner.badge}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Reorder */}
        <button
          onClick={() => onReorder("up")}
          disabled={pending || isFirst}
          className="p-1.5 text-slate-400 hover:text-meb-green transition disabled:opacity-30"
          title="เลื่อนขึ้น"
        >
          <PhosphorIcon name="caret-up" weight="bold" />
        </button>
        <button
          onClick={() => onReorder("down")}
          disabled={pending || isLast}
          className="p-1.5 text-slate-400 hover:text-meb-green transition disabled:opacity-30"
          title="เลื่อนลง"
        >
          <PhosphorIcon name="caret-down" weight="bold" />
        </button>

        {/* Toggle */}
        <button
          onClick={onToggle}
          disabled={pending}
          className="p-1.5 text-slate-400 hover:text-meb-green transition"
          title={banner.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        >
          <PhosphorIcon name={banner.is_active ? "eye" : "eye-slash"} />
        </button>

        {/* Edit */}
        <button
          onClick={onEdit}
          disabled={pending}
          className="p-1.5 text-slate-400 hover:text-meb-green transition"
          title="แก้ไข"
        >
          <PhosphorIcon name="pencil-simple" weight="bold" />
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={pending}
          className="p-1.5 text-slate-400 hover:text-price-red transition"
          title="ลบ"
        >
          <PhosphorIcon name="trash" weight="bold" />
        </button>
      </div>
    </div>
  );
}