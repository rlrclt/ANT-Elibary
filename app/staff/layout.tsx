import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { StaffHeader } from "../components/staff-header";
import { StaffSidebar } from "../components/staff-sidebar";
import { StaffFooter } from "../components/staff-footer";
import { PhosphorIcon } from "../components/phosphor-icon";
import { BarcodeCartProvider } from "./books/components/barcode-cart-context";

export const metadata = {
  title: {
    default: "เจ้าหน้าที่ — ANT E-Library",
    template: "%s — ANT E-Library",
  },
};

/**
 * StaffLayout — ครอบทุกหน้า /staff/*
 * - ตรวจ session + role (staff/admin เท่านั้น)
 * - ดึงข้อมูล user จริงจาก public.users
 * - ส่ง fullName/userIdCode/department ให้ Header/Sidebar
 * - หน้า /staff/books/print จะไม่แสดง StaffSidebar ตามคำขอ
 */
export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, user_id_code, role, department, class_level, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // ถ้าไม่มี profile หรือไม่ใช่ staff/admin → ส่งไป /member
  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    redirect("/member");
  }

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  const isPrintPage = pathname.startsWith("/staff/books/print");

  // หน้าพิมพ์บาร์โค้ด → แสดงผลเต็มจอ 100% ไม่ต้องมี StaffSidebar หรือ Header/Footer มาบัง
  if (isPrintPage) {
    return (
      <BarcodeCartProvider>
        <div className="w-full min-h-screen bg-[#F8FAFC]">
          {children}
        </div>
      </BarcodeCartProvider>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-page-bg dark:bg-page-bg transition-colors duration-300">
      <BarcodeCartProvider>
      <StaffHeader
        fullName={profile.full_name}
        userIdCode={profile.user_id_code}
        avatarUrl={profile.avatar_url}
      />

      {/* Mobile nav — แทน sidebar บนมือถือ */}
      <nav className="md:hidden bg-white dark:bg-card-bg border-b border-gray-200 dark:border-border-base sticky top-[60px] z-40 shadow-sm transition-colors print:hidden">
        <div className="px-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar py-2">
          <Link
            href="/staff"
            className="px-4 py-1.5 bg-meb-light text-meb-green font-bold text-sm rounded-full border border-meb-green/20 flex items-center gap-1.5 shrink-0"
          >
            <PhosphorIcon name="squares-four" weight="fill" /> แดชบอร์ด
          </Link>
          <Link
            href="/staff/books"
            className="px-4 py-1.5 text-gray-600 hover:bg-gray-50 font-medium text-sm rounded-full border border-gray-200 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <PhosphorIcon name="books" /> หนังสือ
          </Link>
          <Link
            href="/staff/books/damaged"
            className="px-4 py-1.5 text-gray-600 hover:bg-gray-50 font-medium text-sm rounded-full border border-gray-200 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <PhosphorIcon name="warning-circle" /> หนังสือชำรุด
          </Link>
          <Link
            href="/staff/members"
            className="px-4 py-1.5 text-gray-600 hover:bg-gray-50 font-medium text-sm rounded-full border border-gray-200 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <PhosphorIcon name="users" /> สมาชิก
          </Link>
          <Link
            href="/staff/loans"
            className="px-4 py-1.5 text-gray-600 hover:bg-gray-50 font-medium text-sm rounded-full border border-gray-200 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <PhosphorIcon name="arrow-clock" /> ยืม-คืน
          </Link>
          <Link
            href="/staff/books/history"
            className="px-4 py-1.5 text-gray-600 hover:bg-gray-50 font-medium text-sm rounded-full border border-gray-200 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <PhosphorIcon name="chart-pie-slice" /> รายงานยืม-คืน
          </Link>
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto w-full px-4 py-6 flex-1 flex flex-col md:flex-row gap-6">
        <StaffSidebar
          fullName={profile.full_name}
          department={profile.department}
          classLevel={profile.class_level}
          avatarUrl={profile.avatar_url}
          role={profile.role}
        />
        <main className="flex-1 space-y-6">{children}</main>
      </div>

      <StaffFooter />
      </BarcodeCartProvider>
    </div>
  );
}