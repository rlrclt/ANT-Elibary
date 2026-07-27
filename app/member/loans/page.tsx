import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { LoanTabs } from "./components/loan-tabs";
import {
  getMyBorrowsAction,
  getMyActiveBorrowsAction,
  getMyFineSummaryAction,
} from "./actions";

export const metadata: Metadata = {
  title: "ยืม-คืนหนังสือ",
};

/**
 * หน้ายืม-คืนหนังสือสำหรับสมาชิก (/member/loans)
 * - ตรวจ auth: ถ้า !user → /login, ถ้า staff/admin → /staff
 * - ดึง profile (borrow_limit, fine_balance)
 * - ดึงข้อมูลเริ่มต้น: ประวัติยืมทั้งหมด + รายการยืมปัจจุบัน + สรุปค่าปรับ
 * - ส่งให้ <LoanTabs /> เรนเดอร์ UI 3 แท็บ
 */
export default async function MemberLoansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ตรวจ role — ถ้า staff/admin → ส่งไป /staff
  const { data: profile } = await supabase
    .from("users")
    .select("role, borrow_limit, fine_balance")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && (profile.role === "staff" || profile.role === "admin")) {
    redirect("/staff");
  }

  // ดึงข้อมูลเริ่มต้นพร้อมกัน
  const [borrowsResult, activeResult, finesResult] = await Promise.all([
    getMyBorrowsAction(),
    getMyActiveBorrowsAction(),
    getMyFineSummaryAction(),
  ]);

  const borrowLimit = profile?.borrow_limit ?? 5;
  const fineBalance = Number(profile?.fine_balance ?? 0);
  const activeCount = activeResult.data?.length ?? 0;

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
          ยืม-คืนหนังสือ
        </span>
      </nav>

      {/* Header */}
      <div className="p-5 sm:p-6 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base relative overflow-hidden transition-colors shadow-sm">
        <div className="absolute top-0 left-0 bottom-0 w-2 bg-meb-green" />
        <div className="pl-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-forest dark:text-slate-100 flex items-center gap-2">
              <PhosphorIcon name="arrows-clockwise" weight="fill" className="text-meb-green" />
              ยืม-คืนหนังสือ
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              ยืม-คืนด้วยตนเอง ต่ออายุ และชำระค่าปรับ ได้ที่นี่
            </p>
          </div>

          {/* สรุปสถิติ */}
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">ยืมได้สูงสุด</p>
              <p className="font-bold text-meb-green text-lg">
                {activeCount}<span className="text-slate-400 font-normal">/{borrowLimit}</span> เล่ม
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">ค่าปรับคงค้าง</p>
              <p className={`font-bold text-lg ${fineBalance > 0 ? "text-price-red" : "text-slate-400 dark:text-slate-500"}`}>
                ฿{fineBalance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab controller */}
      <LoanTabs
        initialBorrows={borrowsResult.data ?? []}
        initialActive={activeResult.data ?? []}
        initialFines={
          finesResult.data ?? { totalUnpaid: 0, unpaidCount: 0, paidCount: 0 }
        }
        userId={user.id}
      />
    </div>
  );
}