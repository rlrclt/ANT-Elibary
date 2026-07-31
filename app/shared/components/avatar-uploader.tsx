"use client";

import { useState, useTransition, useRef } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import {
  uploadAvatarAction,
  deleteAvatarAction,
} from "@/app/shared/actions/upload-avatar";

/**
 * AvatarUploader — คอมโพเนนต์อัปโหลดรูปโปรไฟล์
 *
 * ใช้ร่วมกันได้ทั้ง /staff/settings และ /member/profile
 * - แสดงรูปปัจจุบัน (หรือ initials ถ้าไม่มี)
 * - ปุ่มเลือกไฟล์ → ตรวจสอบ size + MIME → อัปโหลด
 * - ปุ่มลบรูป (ถ้ามี)
 *
 * ข้อจำกัด:
 *   - ขนาดสูงสุด 3MB
 *   - MIME types: image/jpeg, image/png, image/webp, image/gif
 */

type AvatarUploaderProps = {
  initialAvatarUrl: string;
  fullName: string;
};

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function AvatarUploader({
  initialAvatarUrl,
  fullName,
}: AvatarUploaderProps) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = fullName.slice(0, 2).trim().toUpperCase();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(false);

    // ตรวจสอบ MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("รองรับเฉพาะไฟล์ภาพ JPEG, PNG, WebP หรือ GIF เท่านั้น");
      e.target.value = "";
      return;
    }

    // ตรวจสอบขนาด
    if (file.size > MAX_FILE_SIZE) {
      setError("ขนาดไฟล์ต้องไม่เกิน 3MB");
      e.target.value = "";
      return;
    }

    // แสดง preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // อัปโหลดทันที
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const res = await uploadAvatarAction(formData);
      if (res.error) {
        setError(res.error);
        setPreview(null);
        return;
      }
      setAvatarUrl(res.url ?? "");
      setSuccess(true);
      setPreview(null);
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  function handleDelete() {
    if (!confirm("ต้องการลบรูปโปรไฟล์ใช่หรือไม่?")) return;

    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const res = await deleteAvatarAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setAvatarUrl("");
      setPreview(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  const displayUrl = preview ?? avatarUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* รูปโปรไฟล์ */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-meb-green/10 text-meb-green border-2 border-meb-green/20 flex items-center justify-center text-2xl font-bold overflow-hidden">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* loading overlay */}
        {pending && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <PhosphorIcon
              name="circle-notch"
              className="text-white text-2xl animate-spin"
            />
          </div>
        )}
      </div>

      {/* ปุ่มอัปโหลด + ลบ */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
          id="avatar-upload"
          disabled={pending}
        />
        <label
          htmlFor="avatar-upload"
          className={`inline-flex items-center gap-1.5 text-sm font-bold text-meb-green bg-meb-light hover:bg-meb-light/70 px-3 py-2 rounded-md transition cursor-pointer ${
            pending ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <PhosphorIcon name="camera" weight="fill" className="text-sm" />
          {avatarUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
        </label>

        {avatarUrl && !pending && (
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-price-red dark:text-slate-400 transition"
          >
            <PhosphorIcon name="trash" className="text-sm" />
            ลบรูป
          </button>
        )}
      </div>

      {/* ข้อความแจ้งเตือน */}
      {error && (
        <p className="text-xs text-price-red flex items-center gap-1.5">
          <PhosphorIcon name="warning-circle" weight="fill" className="text-sm" />
          {error}
        </p>
      )}

      {success && (
        <p className="text-xs text-meb-green flex items-center gap-1.5">
          <PhosphorIcon name="check-circle" weight="fill" className="text-sm" />
          อัปโหลดรูปโปรไฟล์สำเร็จ
        </p>
      )}

      {/* คำแนะนำ */}
      <p className="text-xs text-slate-400 text-center">
        รองรับ JPEG, PNG, WebP, GIF (สูงสุด 3MB)
      </p>
    </div>
  );
}