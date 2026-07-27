import { createClient } from "@/utils/supabase/server";
import {
  getActiveBorrowsAction,
  getLoanStatsAction,
} from "./actions";
import { LoansClient } from "./components/loans-client";

export const metadata = {
  title: "ยืม-คืนหนังสือ",
};

/**
 * หน้ายืม-คืนหนังสือ (/staff/loans)
 * - layout.tsx จัด Header/Sidebar/Footer + auth guard ให้แล้ว
 * - หน้านี้ดึงข้อมูลเริ่มต้น (active borrows + stats) แล้วส่งให้ LoansClient
 */
export default async function StaffLoansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // ดึงข้อมูลเริ่มต้นพร้อมกัน
  const [recordsResult, statsResult] = await Promise.all([
    getActiveBorrowsAction(),
    getLoanStatsAction(),
  ]);

  return (
    <LoansClient
      initialRecords={recordsResult.data ?? []}
      initialStats={
        statsResult.data ?? { active: 0, overdue: 0, returnedToday: 0, totalFines: 0 }
      }
    />
  );
}