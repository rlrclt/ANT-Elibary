import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { HistoryTable, type HistoryRecord } from "./components/history-table";

export const metadata: Metadata = {
  title: "ประวัติการยืม-คืน — ANT E-Library",
};

/**
 * หน้าประวัติการยืม-คืนสำหรับสมาชิก (/member/history)
 * แสดงประวัติการยืมคืนหนังสือทั้งหมดของฉันเรียงจากใหม่สุดไปเก่าสุด
 */
export default async function MemberHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ดึงประวัติการยืมทั้งหมดของฉัน
  const { data: history } = await supabase
    .from("v_borrow_records_detail")
    .select("*")
    .eq("user_id", user.id)
    .order("borrowed_at", { ascending: false });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav aria-label="breadcrumb" className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
        <Link href="/member" className="hover:text-meb-green transition">
          หน้าแรก
        </Link>
        <PhosphorIcon name="caret-right" className="text-[10px] text-slate-400" />
        <span className="text-slate-700 dark:text-slate-200 font-medium">
          ประวัติการยืม-คืน
        </span>
      </nav>

      {/* Header */}
      <div className="p-6 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base relative overflow-hidden transition-colors shadow-sm">
        <div className="absolute top-0 left-0 bottom-0 w-2 bg-indigo-500" />
        <h1 className="text-2xl font-bold text-forest dark:text-slate-100 flex items-center gap-2 pl-2">
          <PhosphorIcon name="clock-counter-clockwise" weight="fill" className="text-indigo-500" />
          ประวัติการยืม-คืนหนังสือ
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 pl-2">
          บันทึกประวัติการใช้บริการห้องสมุด ยืมและส่งคืนตำราเรียนทั้งหมดของคุณย้อนหลัง
        </p>
      </div>

      {/* History table */}
      {!history || history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base text-slate-400 transition-colors">
          <PhosphorIcon name="clock" className="text-5xl mb-3 text-slate-300" />
          <p className="text-sm">คุณยังไม่มีประวัติการยืมหนังสือในระบบ</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-card-bg rounded-xl border border-gray-100 dark:border-border-base overflow-hidden transition-colors shadow-sm">
          <HistoryTable records={history as HistoryRecord[]} />
        </div>
      )}
    </div>
  );
}
