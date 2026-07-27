import { createClient } from "@/utils/supabase/server";
import { getAnnouncementsAction } from "./actions";
import { AnnouncementsClient } from "./components/announcements-client";

export const metadata = {
  title: "จัดการประกาศ",
};

/**
 * หน้าจัดการประกาศ (/staff/announcements)
 * - layout.tsx จัด Header/Sidebar/Footer + auth guard ให้แล้ว (staff/admin)
 * - หน้านี้ตรวจ user อีกชั้น แล้วดึงข้อมูลประกาศเริ่มต้น
 */
export default async function StaffAnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const result = await getAnnouncementsAction();

  return <AnnouncementsClient initialAnnouncements={result.data ?? []} />;
}