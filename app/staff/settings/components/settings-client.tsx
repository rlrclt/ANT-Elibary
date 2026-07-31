"use client";

import { useState } from "react";
import { PhosphorIcon } from "../../../components/phosphor-icon";
import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { ChangeEmailForm } from "./change-email-form";
import { ForgotPasswordModal } from "./forgot-password-modal";
import { LineLinkSection } from "@/app/shared/components/line-link-section";

import { getDropdownOptionsAction, type DropdownOption } from "@/app/staff/settings/dropdowns/actions";

export type StaffProfile = {
  id: string;
  full_name: string;
  user_id_code: string;
  email: string;
  phone: string;
  department: string;
  class_level: string;
  class_number: string;
  address: string;
  avatar_url: string;
  role: string;
  fine_balance: number;
  created_at: string;
  user_type?: string;
  department_id?: string;
  class_level_id?: string;
  room_level_id?: string;
  room_level?: string;
  class_group_id?: string;
  class_group?: string;
  gender?: string;
};

type SettingsClientProps = {
  initialProfile: StaffProfile;
  userEmail: string | null;
  departments: DropdownOption[];
  classLevels: DropdownOption[];
  roomLevels: DropdownOption[];
  classGroups: DropdownOption[];
};

type TabKey = "profile" | "notifications" | "security";

/** ตัวเลือกย่อยในแท็บความปลอดภัย — เลือกทีละอย่างไม่ขึ้นพร้อมกัน */
type SecurityOption = "password" | "email";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "profile", label: "ข้อมูลส่วนตัว", icon: "user-focus" },
  { key: "notifications", label: "การแจ้งเตือน", icon: "bell-ringing" },
  { key: "security", label: "ความปลอดภัย", icon: "shield-check" },
];

const SECURITY_OPTIONS: {
  key: SecurityOption;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    key: "password",
    label: "เปลี่ยนรหัสผ่าน",
    description: "เปลี่ยนรหัสผ่านเข้าระบบของคุณ",
    icon: "key",
  },
  {
    key: "email",
    label: "เปลี่ยนอีเมล",
    description: "เปลี่ยนอีเมลที่ใช้เข้าระบบ (ต้องยืนยันอีเมลใหม่)",
    icon: "envelope-simple",
  },
];

/**
 * SettingsClient — คอมโพเนนต์หลักสำหรับหน้าโปรไฟล์
 * จัดการ: หัวหน้าโปรไฟล์ (avatar + ชื่อ + role badge), tab navigation, และเนื้อหา tab
 */
export function SettingsClient({
  initialProfile,
  userEmail,
  departments,
  classLevels,
  roomLevels,
  classGroups,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [securityOption, setSecurityOption] = useState<SecurityOption | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const initials = initialProfile.full_name.slice(0, 2).trim();

  // role badge: staff=amber "เจ้าหน้าที่", admin=red "ผู้ดูแล"
  const isAdmin = initialProfile.role === "admin";
  const roleLabel = isAdmin ? "ผู้ดูแล" : "เจ้าหน้าที่";
  const roleBadgeClass = isAdmin
    ? "bg-price-red/10 text-price-red"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";

  return (
    <div className="space-y-6">
      {/* หัวหน้าตั้งค่า — avatar + ชื่อ + รหัส + role badge */}
      <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 sm:p-6 transition-colors shadow-sm flex flex-col sm:flex-row items-center gap-5">
        <div className="w-12 h-12 rounded-full bg-meb-green/10 text-meb-green border border-meb-green/20 flex items-center justify-center text-base font-bold shrink-0 overflow-hidden">
          {initialProfile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={initialProfile.avatar_url}
              alt={initialProfile.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="text-center sm:text-left space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-xl font-bold text-forest dark:text-slate-100">
              {initialProfile.full_name}
            </h1>
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-bold ${roleBadgeClass}`}
            >
              {roleLabel}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            รหัสเจ้าหน้าที่:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {initialProfile.user_id_code}
            </span>
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <nav
        className="flex border-b border-gray-100 dark:border-border-base"
        aria-label="แท็บตั้งค่าบัญชี"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-semibold transition-colors -mb-px border-b-2 ${
                active
                  ? "border-meb-green text-meb-green"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-forest dark:hover:text-slate-200"
              }`}
            >
              <PhosphorIcon name={tab.icon} weight={active ? "fill" : "regular"} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      {activeTab === "profile" && (
        <ProfileForm
          initialProfile={initialProfile}
          departments={departments}
          classLevels={classLevels}
          roomLevels={roomLevels}
          classGroups={classGroups}
        />
      )}

      {activeTab === "notifications" && (
        <div className="space-y-4">
          <LineLinkSection />
        </div>
      )}

      {activeTab === "security" && (
        <div className="space-y-4">
          {securityOption === null ? (
            /* Step 1: เลือกว่าจะเปลี่ยนอะไร */
            <>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                เลือกสิ่งที่ต้องการเปลี่ยนแปลง
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SECURITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSecurityOption(opt.key)}
                    className="card-lift flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-card-bg border border-gray-100 dark:border-border-base hover:border-meb-green/30 transition text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-meb-light dark:bg-meb-green/15 flex items-center justify-center text-meb-green text-xl shrink-0">
                      <PhosphorIcon name={opt.icon} weight="fill" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-forest dark:text-slate-100">
                        {opt.label}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                    <PhosphorIcon
                      name="caret-right"
                      weight="bold"
                      className="text-slate-300 dark:text-slate-600 ml-auto shrink-0"
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Step 2: ฟอร์มที่เลือก */
            <>
              {/* ปุ่มย้อนกลับไปเลือก */}
              <button
                onClick={() => setSecurityOption(null)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-meb-green dark:hover:text-meb-light transition"
              >
                <PhosphorIcon name="caret-left" weight="bold" />
                กลับไปเลือก
              </button>

              {securityOption === "password" && (
                <ChangePasswordForm
                  userEmail={userEmail}
                  onForgotPassword={() => setForgotOpen(true)}
                />
              )}
              {securityOption === "email" && (
                <ChangeEmailForm currentEmail={userEmail ?? initialProfile.email} />
              )}
            </>
          )}
        </div>
      )}

      {/* Modal ลืมรหัสผ่าน */}
      <ForgotPasswordModal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        userEmail={userEmail ?? initialProfile.email}
      />
    </div>
  );
}