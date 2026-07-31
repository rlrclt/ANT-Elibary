"use client";

import { useState, useTransition } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { TextField, SubmitButton, SelectField } from "../../../components/form-controls";
import { updateStaffProfileAction } from "../actions";
import { AvatarUploader } from "@/app/shared/components/avatar-uploader";
import type { StaffProfile } from "./settings-client";
import type { DropdownOption } from "@/app/staff/settings/dropdowns/actions";

type ProfileFormProps = {
  initialProfile: StaffProfile;
  departments: DropdownOption[];
  classLevels: DropdownOption[];
  roomLevels: DropdownOption[];
  classGroups: DropdownOption[];
};

const roleLabel = (role: string): string => {
  if (role === "admin") return "ผู้ดูแล";
  if (role === "staff") return "เจ้าหน้าที่";
  return "นักศึกษา";
};

const genderLabel = (gender?: string): string => {
  if (gender === "male") return "ชาย (Male)";
  if (gender === "female") return "หญิง (Female)";
  if (gender === "other") return "อื่นๆ (Other)";
  return "ไม่ระบุ (Not Specified)";
};

/**
 * ProfileForm — แสดงข้อมูลเจ้าหน้าที่แบบ read-only ก่อน
 * กด "แก้ไขข้อมูล" → เปิดฟอร์มแก้ไข
 * บันทึก/ยกเลิก → กลับสู่โหมดดู
 */
export function ProfileForm({
  initialProfile,
  departments,
  classLevels,
  roomLevels,
  classGroups,
}: ProfileFormProps) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const userType = initialProfile.user_type || "staff";
  const [selectedDeptId, setSelectedDeptId] = useState(initialProfile.department_id || "");
  const [selectedClassLevelId, setSelectedClassLevelId] = useState(initialProfile.class_level_id || "");
  const [selectedRoomLevelId, setSelectedRoomLevelId] = useState(initialProfile.room_level_id || "");
  const [selectedClassGroupId, setSelectedClassGroupId] = useState(initialProfile.class_group_id || "");
  const [selectedGender, setSelectedGender] = useState(initialProfile.gender || "not_specified");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateStaffProfileAction(formData);
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
          <InfoRow label="รหัสเจ้าหน้าที่" value={initialProfile.user_id_code} icon="identification-card" />
          <InfoRow label="อีเมล" value={initialProfile.email || "—"} icon="envelope-simple" hint="เปลี่ยนในแท็บความปลอดภัย" />
          <InfoRow label="เบอร์โทรศัพท์" value={initialProfile.phone || "—"} icon="phone" />
          <InfoRow label="เพศ" value={genderLabel(initialProfile.gender)} icon="gender-interstellar" />
          
          {userType !== "external" && (
            <InfoRow label="แผนก / สังกัด" value={initialProfile.department || "—"} icon="buildings" />
          )}

          {userType === "student" && (
            <>
              <InfoRow label="ระดับชั้น" value={initialProfile.class_level || "—"} icon="graduation-cap" />
              <InfoRow label="ห้องเรียน/กลุ่มเรียน" value={initialProfile.room_level || "—"} icon="door" />
              <InfoRow label="รหัสกลุ่มเรียน" value={initialProfile.class_group || "—"} icon="users" />
              <InfoRow label="เลขที่" value={initialProfile.class_number || "—"} icon="hash" />
            </>
          )}

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
            label="รหัสเจ้าหน้าที่"
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
        <SelectField
          label="เพศ"
          name="gender"
          required
          value={selectedGender}
          onChange={(e) => setSelectedGender(e.target.value)}
          options={[
            { value: "not_specified", label: "-- ระบุเพศ --" },
            { value: "male", label: "ชาย (Male)" },
            { value: "female", label: "หญิง (Female)" },
            { value: "other", label: "อื่นๆ (Other)" },
          ]}
          icon="gender-interstellar"
        />
        {userType !== "external" && (
          <SelectField
            label="แผนกวิชา"
            name="department_id"
            required
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            icon="tree-structure"
          />
        )}

        {userType === "student" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="ระดับชั้น"
                name="class_level_id"
                required
                value={selectedClassLevelId}
                onChange={(e) => setSelectedClassLevelId(e.target.value)}
                options={classLevels.map((c) => ({ value: c.id, label: c.name }))}
                icon="graduation-cap"
              />

              <SelectField
                label="กลุ่มเรียน/ห้องเรียน"
                name="room_level_id"
                required
                value={selectedRoomLevelId}
                onChange={(e) => setSelectedRoomLevelId(e.target.value)}
                options={roomLevels.map((r) => ({ value: r.id, label: r.name }))}
                icon="users"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="รหัสกลุ่มเรียน"
                name="class_group_id"
                required
                value={selectedClassGroupId}
                onChange={(e) => setSelectedClassGroupId(e.target.value)}
                options={classGroups
                  .filter((g) => g.department_id === selectedDeptId && g.class_level_id === selectedClassLevelId)
                  .map((g) => ({
                    value: g.id,
                    label: g.academic_year ? `${g.name} (ปีการศึกษา ${g.academic_year})` : g.name,
                  }))}
                icon="users"
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
          </>
        )}

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