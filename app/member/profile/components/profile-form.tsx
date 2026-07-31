"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { TextField, SubmitButton } from "@/app/components/form-controls";
import { updateProfileAction } from "../actions";
import { AvatarUploader } from "@/app/shared/components/avatar-uploader";
import type { Profile } from "./profile-client";

type ProfileFormProps = {
  initialProfile: Profile;
};

const roleLabel = (role: string): string => {
  if (role === "admin") return "ผู้ดูแลระบบ";
  if (role === "staff") return "เจ้าหน้าที่";
  return "นักศึกษา";
};

/**
 * ProfileForm — แสดงข้อมูลส่วนตัวแบบ read-only ก่อน
 * กด "แก้ไขข้อมูล" → เปิดฟอร์มแก้ไข
 * บันทึก/ยกเลิก → กลับสู่โหมดดู
 */
export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateProfileAction(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  // โหมดดู — แสดงข้อมูลทั้งหมดแบบ read-only + ปุ่มแก้ไข
  if (!editing) {
    return (
      <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 sm:p-6 transition-colors space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-border-base pb-3">
          <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="user-focus" className="text-meb-green" weight="fill" />
            ข้อมูลส่วนตัว
          </h2>
          <button
            onClick={() => setEditing(true)}
            className="btn-cta inline-flex items-center gap-1.5 text-sm font-bold text-meb-green bg-meb-light hover:bg-meb-light/70 px-3 py-1.5 rounded-md transition"
          >
            <PhosphorIcon name="pencil-simple" weight="bold" className="text-sm" />
            แก้ไขข้อมูล
          </button>
        </div>

        {success && (
          <div className="flex items-center gap-2 bg-meb-light/50 border border-meb-green/30 text-meb-hover text-sm px-3 py-2.5 rounded-md">
            <PhosphorIcon name="check-circle" weight="fill" />
            บันทึกข้อมูลเรียบร้อยแล้ว
          </div>
        )}

        {/* รูปโปรไฟล์ — อัปโหลดได้ทันที */}
        <div className="flex justify-center py-2">
          <AvatarUploader
            initialAvatarUrl={initialProfile.avatar_url}
            fullName={initialProfile.full_name}
          />
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <InfoRow label="ชื่อ-สกุล" value={initialProfile.full_name} icon="user" />
          <InfoRow label="รหัสสมาชิก" value={initialProfile.user_id_code} icon="identification-card" />
          <InfoRow label="อีเมล" value={initialProfile.email || "—"} icon="envelope-simple" hint="เปลี่ยนในแท็บความปลอดภัย" />
          <InfoRow label="เบอร์โทรศัพท์" value={initialProfile.phone || "—"} icon="phone" />
          <InfoRow label="แผนก / สังกัด" value={initialProfile.department || "—"} icon="buildings" />
          <InfoRow label="ระดับชั้น" value={initialProfile.class_level || "—"} icon="graduation-cap" />
          <InfoRow label="เลขที่" value={initialProfile.class_number || "—"} icon="hash" />
          <InfoRow label="บทบาท" value={roleLabel(initialProfile.role)} icon="shield-check" />
          <InfoRow label="ค่าปรับคงค้าง" value={`฿ ${Number(initialProfile.fine_balance).toFixed(2)}`} icon="currency-dollar" />
        </dl>

        {/* ที่อยู่ full width */}
        <div className="pt-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
            <PhosphorIcon name="map-pin" className="text-slate-400" />
            ที่อยู่ติดต่อ
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-gray-50 dark:bg-black/20 rounded-md px-3 py-2.5 min-h-[40px]">
            {initialProfile.address || "—"}
          </p>
        </div>
      </section>
    );
  }

  // โหมดแก้ไข — ฟอร์ม
  return (
    <section className="bg-white dark:bg-card-bg rounded-xl shadow-sm border border-gray-100 dark:border-border-base p-5 sm:p-6 transition-colors space-y-5">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-border-base pb-3">
        <h2 className="text-base font-bold text-forest dark:text-slate-100 flex items-center gap-2">
          <PhosphorIcon name="pencil-simple" className="text-meb-green" weight="fill" />
          แก้ไขข้อมูลส่วนตัว
        </h2>
        <button
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-price-red dark:hover:text-price-red transition"
        >
          <PhosphorIcon name="x" className="text-sm" />
          ยกเลิก
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-price-red/10 border border-price-red/30 text-price-red text-sm px-3 py-2.5 rounded-md">
          <PhosphorIcon name="warning-circle" weight="fill" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-1">
        {/* ฟิลด์อ่านอย่างเดียว */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
          <ReadOnlyField
            label="รหัสสมาชิก"
            value={initialProfile.user_id_code}
            icon="identification-card"
          />
          <ReadOnlyField
            label="อีเมล"
            value={initialProfile.email || "—"}
            icon="envelope-simple"
            hint="เปลี่ยนในแท็บความปลอดภัย"
          />
        </div>

        {/* ฟิลด์แก้ไขได้ */}
        <TextField
          label="ชื่อ-สกุล"
          name="full_name"
          type="text"
          required
          icon="user"
          defaultValue={initialProfile.full_name}
        />
        <TextField
          label="เบอร์โทรศัพท์"
          name="phone"
          type="tel"
          placeholder="08xxxxxxxx"
          icon="phone"
          defaultValue={initialProfile.phone}
        />
        <TextField
          label="แผนก / สังกัด"
          name="department"
          type="text"
          placeholder="เช่น เทคโนโลยีสารสนเทศ"
          icon="buildings"
          defaultValue={initialProfile.department}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="ระดับชั้น"
            name="class_level"
            type="text"
            placeholder="เช่น ปวช. 1"
            icon="graduation-cap"
            defaultValue={initialProfile.class_level}
          />
          <TextField
            label="เลขที่"
            name="class_number"
            type="text"
            placeholder="เช่น 15"
            icon="hash"
            defaultValue={initialProfile.class_number}
          />
        </div>

        {/* ที่อยู่ — textarea */}
        <div className="mb-4">
          <label
            htmlFor="address"
            className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5"
          >
            ที่อยู่ติดต่อ
          </label>
          <textarea
            id="address"
            name="address"
            rows={3}
            defaultValue={initialProfile.address}
            placeholder="กรอกที่อยู่..."
            className="w-full px-3 py-2.5 text-sm bg-white dark:bg-card-bg border border-gray-200 dark:border-border-base rounded-md outline-none focus:border-meb-green focus:ring-2 focus:ring-meb-light text-forest dark:text-slate-100 resize-none transition"
          />
        </div>

        {/* ฟิลด์สิทธิ์ (อ่านอย่างเดียว) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pt-2 border-t border-gray-100 dark:border-border-base/50">
          <ReadOnlyField
            label="บทบาท"
            value={roleLabel(initialProfile.role)}
            icon="shield-check"
          />
          <ReadOnlyField
            label="ค่าปรับคงค้าง"
            value={`฿ ${Number(initialProfile.fine_balance).toFixed(2)}`}
            icon="currency-dollar"
          />
        </div>

        <div className="flex gap-2">
          <SubmitButton loading={pending}>
            บันทึกการเปลี่ยนแปลง
            <PhosphorIcon name="floppy-disk" />
          </SubmitButton>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="px-5 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md border border-gray-200 dark:border-border-base transition"
          >
            ยกเลิก
          </button>
        </div>
      </form>
    </section>
  );
}

/** แถวข้อมูลในโหมดดู — label + value + icon */
function InfoRow({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
        <PhosphorIcon name={icon} className="text-slate-400" />
        {label}
      </dt>
      <dd className="text-sm text-slate-700 dark:text-slate-200 font-medium">
        {value}
        {hint && (
          <span className="block text-xs text-slate-400 font-normal mt-0.5">{hint}</span>
        )}
      </dd>
    </div>
  );
}

/** ฟิลด์อ่านอย่างเดียว — แสดงค่าในกล่องสีเทา disabled (ใช้ในโหมดแก้ไข) */
function ReadOnlyField({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-forest dark:text-slate-100 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-base rounded-md text-slate-500 dark:text-slate-400">
        <PhosphorIcon name={icon} className="text-slate-400" />
        <span className="flex-1 truncate">{value}</span>
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}