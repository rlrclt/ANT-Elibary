import Link from "next/link";
import { PhosphorIcon } from "./phosphor-icon";
import { ScrollReveal } from "./scroll-reveal";
import type { ReactNode } from "react";

/**
 * AuthLayout — สำหรับหน้า /login และ /register
 * ตาม page-patterns.md กลุ่มที่ 3 (Transactional) + ข้อกำหนดหน้าบัญชี
 * - Desktop: 2-col (visual ฝั่งซ้าย 6/12 + form ฝั่งขวา 6/12)
 * - Mobile: single-column stack (form อยู่บน, visual ซ่อน เพราะเปลืองพื้นที่)
 * - Footer เรียบ (ตามกฎหน้า transactional)
 */
type AuthLayoutProps = {
  /** บริบท: "เข้าสู่ระบบ" | "สมัครสมาชิก" */
  variant: "login" | "register";
  /** โลโก้/หัวข้อด้านบน form */
  title: string;
  subtitle: string;
  children: ReactNode;
  /** ลิงก์ไปหน้า auth อีกหน้า */
  alternateHref: string;
  alternateLabel: string;
  alternatePrompt: string;
};

export function AuthLayout({
  variant,
  title,
  subtitle,
  children,
  alternateHref,
  alternateLabel,
  alternatePrompt,
}: AuthLayoutProps) {
  const isRegister = variant === "register";

  return (
    <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-64px)]">
      {/* Visual panel — ซ่อนบนมือถือ (เปลืองพื้นที่ ผู้ใช้โฟกัส form) */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex lg:col-span-5 bg-forest text-white relative overflow-hidden flex-col justify-between p-12"
      >
        {/* Decorative blobs — Explorecore */}
        <div
          aria-hidden="true"
          className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-meb-green/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-terracotta/15 blur-3xl"
        />

        {/* Logo บน */}
        <Link
          href="/"
          className="relative text-2xl font-black tracking-tighter text-white"
        >
          ANT<span className="font-light">E-Library</span>
        </Link>

        {/* ข้อความกลาง */}
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight mb-4">
            {isRegister
              ? "เริ่มต้นการเดินทางสู่ความรู้"
              : "ยินดีต้อนรับกลับสู่ห้องสมุด"}
          </h2>
          <p className="text-white/80 leading-relaxed max-w-md">
            {isRegister
              ? "สมัครสมาชิกเพื่อเข้าถึงคลังหนังสือดิจิทัลกว่า 5,000 รายการ พร้อมเครื่องมือช่วยอ่านที่ทันสมัย ฟรีสำหรับนักศึกษาและบุคลากร วิทยาลัยเทคนิคอำนาจเจริญ"
              : "เข้าสู่ระบบเพื่อดำเนินการต่อกับคลังหนังสือดิจิทัล ที่คั่นหน้า และประวัติการอ่านของคุณจะถูกซิงค์อัตโนมัติ"}
          </p>
        </div>

        {/* Trust signals ล่าง */}
        <div className="relative flex items-center gap-6 text-sm text-white/70">
          <div className="flex items-center gap-2">
            <PhosphorIcon name="shield-check" weight="fill" className="text-meb-light" />
            ปลอดภัย
          </div>
          <div className="flex items-center gap-2">
            <PhosphorIcon name="users" weight="fill" className="text-meb-light" />
            1,200+ สมาชิก
          </div>
          <div className="flex items-center gap-2">
            <PhosphorIcon name="clock" weight="fill" className="text-meb-light" />
            24/7
          </div>
        </div>
      </aside>

      {/* Form panel — desktop 7/12 col, mobile เต็มจอ */}
      <section className="lg:col-span-7 flex items-center justify-center px-4 py-10 sm:py-16 bg-cream">
        <ScrollReveal direction="up" className="w-full max-w-md">
          {/* Logo บนมือถือ (ซ่อนบน desktop เพราะ visual panel มีอยู่แล้ว) */}
          <Link
            href="/"
            className="lg:hidden block text-2xl font-black tracking-tighter text-forest mb-8 text-center"
          >
            ANT<span className="font-light">E-Library</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-forest mb-2">
              {title}
            </h1>
            <p className="text-slate-600 text-sm">{subtitle}</p>
          </div>

          {children}

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-slate-400">หรือ</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Alternate link */}
          <p className="text-center text-sm text-slate-600">
            {alternatePrompt}{" "}
            <Link
              href={alternateHref}
              className="font-semibold text-meb-green hover:text-meb-hover hover:underline"
            >
              {alternateLabel}
            </Link>
          </p>
        </ScrollReveal>
      </section>
    </main>
  );
}