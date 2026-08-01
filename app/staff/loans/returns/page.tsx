import { createClient } from "@/utils/supabase/server";
import { getPendingReturnsAction } from "./actions";
import { ReturnsClient } from "./components/returns-client";

export const metadata = {
  title: "ตรวจสอบการคืน",
};

/**
 * หน้ารับตรวจสอบคำขอกลืนคืน (/staff/loans/returns)
 * - layout.tsx จัด Header/Sidebar/Footer + auth guard ให้แล้ว
 * - ดึงรายการ pending_return ทั้งหมด แล้วส่งให้ ReturnsClient
 */
export default async function StaffReturnsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const result = await getPendingReturnsAction();

  return <ReturnsClient initialRecords={result.data ?? []} />;
}
