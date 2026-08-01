import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { AccessClient } from "./components/access-client";
import {
  getMyActiveLogAction,
  getMyAccessHistoryAction,
  getAccessPurposesAction,
  getTodayLibraryHoursAction,
} from "./actions";

export const metadata: Metadata = {
  title: "เข้าใช้ห้องสมุด",
};

/**
 * หน้าเช็คอิน/เช็คเอาท์ห้องสมุดสำหรับสมาชิก (/member/access)
 * - ตรวจ auth: ถ้า !user → /login, ถ้า staff/admin → /staff
 * - ดึงข้อมูลเริ่มต้น: active log + ประวัติการเข้าใช้
 * - ส่งให้ <AccessClient /> เรนเดอร์ UI
 */
export default async function MemberAccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ตรวจ role — ถ้า staff/admin → ส่งไป /staff
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && (profile.role === "staff" || profile.role === "admin")) {
    redirect("/staff");
  }

  // ดึงข้อมูลเริ่มต้นพร้อมกัน
  const [activeResult, historyResult, purposesResult, hoursResult] =
    await Promise.all([
      getMyActiveLogAction(),
      getMyAccessHistoryAction(),
      getAccessPurposesAction(),
      getTodayLibraryHoursAction(),
    ]);

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <nav
        aria-label="breadcrumb"
        className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap"
      >
        <Link href="/member" className="hover:text-meb-green transition">
          หน้าแรก
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200 font-medium">
          เข้าใช้ห้องสมุด
        </span>
      </nav>

      {/* Header */}
      <div className="p-5 sm:p-6 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base relative overflow-hidden transition-colors shadow-sm">
        <div className="absolute top-0 left-0 bottom-0 w-2 bg-meb-green" />
        <div className="pl-2">
          <h1 className="text-xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
            <PhosphorIcon name="door-open" weight="fill" className="text-meb-green" />
            เข้าใช้ห้องสมุด
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            เช็คอินและเช็คเอาท์เพื่อบันทึกการเข้าใช้ห้องสมุด
          </p>
          {hoursResult.data && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 inline-flex items-center gap-1.5">
              <PhosphorIcon name="clock" className="text-meb-green" />
              {hoursResult.data.isOpen
                ? `วันนี้เปิด ${hoursResult.data.openTime} - ${hoursResult.data.closeTime}`
                : "วันนี้ห้องสมุดปิดทำการ"}
            </p>
          )}
        </div>
      </div>

      {/* เนื้อหาหลัก */}
      <AccessClient
        initialActiveLog={activeResult.data}
        initialHistory={historyResult.data}
        initialPurposes={purposesResult.data}
      />
    </div>
  );
}