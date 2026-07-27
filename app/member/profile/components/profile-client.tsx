"use client";

import { useState, useTransition, useEffect } from "react";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { ChangeEmailForm } from "./change-email-form";
import { ForgotPasswordModal } from "./forgot-password-modal";
import {
  getLineLinkStatusAction,
  unlinkLineAccountAction,
} from "@/app/line/actions";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  class_level: string;
  class_number: string;
  address: string;
  avatar_url: string;
  user_id_code: string;
  role: string;
  fine_balance: number;
  borrow_limit: number;
  created_at: string;
};

type ProfileClientProps = {
  initialProfile: Profile;
  userEmail: string | null;
};

type TabKey = "profile" | "security" | "notifications";

/** ตัวเลือกย่อยในแท็บความปลอดภัย — เลือกทีละอย่างไม่ขึ้นพร้อมกัน */
type SecurityOption = "password" | "email";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "profile", label: "ข้อมูลส่วนตัว", icon: "user-focus" },
  { key: "security", label: "ความปลอดภัย", icon: "shield-check" },
  { key: "notifications", label: "การแจ้งเตือน", icon: "bell" },
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
 * LineLinkSection — ส่วนเชื่อมต่อ LINE ในแท็บการแจ้งเตือน
 */
function LineLinkSection() {
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await getLineLinkStatusAction();
      setLinked(res.linked);
      setLoading(false);
    });
  }, []);

  function handleUnlink() {
    if (!confirm("ต้องการยกเลิกเชื่อมต่อ LINE ใช่หรือไม่?")) return;
    setError(null);
    startTransition(async () => {
      const res = await unlinkLineAccountAction();
      if (res.error) {
        setError(res.error);
        return;
      }
      setLinked(false);
    });
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const liffReady =
    liffId && liffId !== "1234567890-AbCdEfGh";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <PhosphorIcon name="circle-notch" className="text-xl animate-spin mr-2" />
        <span className="text-sm">กำลังตรวจสอบ...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base p-5 transition-colors shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#06C755]/10 flex items-center justify-center text-[#06C755] text-2xl shrink-0">
          <PhosphorIcon name="line-logo" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-forest dark:text-slate-100">
            การแจ้งเตือนผ่าน LINE
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            เชื่อมต่อบัญชี LINE เพื่อรับการแจ้งเตือนการยืม-คืนหนังสือ
            การเข้าใช้ห้องสมุด และประกาศจากระบบ ผ่านแอป LINE ของคุณ
          </p>

          {error && (
            <p className="text-xs text-price-red mt-2">{error}</p>
          )}

          <div className="mt-4">
            {linked ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-meb-green bg-meb-light px-3 py-1.5 rounded-full">
                  <PhosphorIcon name="check-circle" weight="fill" className="text-sm" />
                  เชื่อมต่อแล้ว
                </span>
                <button
                  onClick={handleUnlink}
                  disabled={pending}
                  className="text-xs font-medium text-slate-500 hover:text-price-red dark:text-slate-400 transition disabled:opacity-60"
                >
                  ยกเลิกเชื่อมต่อ
                </button>
              </div>
            ) : liffReady ? (
              <a
                href={`https://liff.line.me/${liffId}`}
                className="inline-flex items-center gap-2 bg-[#06C755] hover:bg-[#05b24d] text-white font-bold px-5 py-2.5 rounded-md text-sm transition"
              >
                <PhosphorIcon name="line-logo" weight="fill" />
                เชื่อมต่อ LINE
              </a>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ระบบยังไม่ได้เปิดใช้งาน LINE integration
                  (ติดต่อเจ้าหน้าที่)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ProfileClient — คอมโพเนนต์หลักสำหรับหน้าโปรไลล์
 * จัดการ: หัวหน้าโปรไลล์ (avatar + ชื่อ + role badge), tab navigation, และเนื้อหา tab
 */
export function ProfileClient({ initialProfile, userEmail }: ProfileClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [securityOption, setSecurityOption] = useState<SecurityOption | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const initials = initialProfile.full_name.slice(0, 2).trim();

  const roleLabel =
    initialProfile.role === "admin"
      ? "ผู้ดูแลระบบ"
      : initialProfile.role === "staff"
        ? "เจ้าหน้าที่"
        : "นักศึกษา";

  return (
    <div className="space-y-6">
      {/* หัวหน้าโปรไลล์ — avatar + ชื่อ + รหัสสมาชิก + role badge */}
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
            <span className="px-2 py-0.5 text-xs bg-meb-green/10 text-meb-green rounded-full font-bold">
              {roleLabel}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            รหัสสมาชิก:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {initialProfile.user_id_code}
            </span>
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <nav
        className="flex border-b border-gray-100 dark:border-border-base"
        aria-label="แท็บโปรไลล์"
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
        <ProfileForm initialProfile={initialProfile} />
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

      {activeTab === "notifications" && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            ช่องทางรับการแจ้งเตือน
          </h2>
          <LineLinkSection />
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