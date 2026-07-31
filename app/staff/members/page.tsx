import { createClient } from "@/utils/supabase/server";
import { getMembersAction, getMemberStatsAction } from "./actions";
import { MembersClient } from "./components/members-client";

export const metadata = {
  title: "จัดการสมาชิก",
};

/**
 * หน้าจัดการสมาชิก (/staff/members)
 * - layout.tsx จัด Header/Sidebar/Footer + auth guard ให้แล้ว
 * - หน้านี้ตรวจ user อีกชั้น แล้วดึงข้อมูลสมาชิก + สถิติเริ่มต้น
 */
export default async function StaffMembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [membersResult, statsResult] = await Promise.all([
    getMembersAction(),
    getMemberStatsAction(),
  ]);

  return (
    <MembersClient
      initialUsers={membersResult.data ?? []}
      initialStats={
        statsResult.data ?? { total: 0, members: 0, staff: 0, suspended: 0 }
      }
    />
  );
}