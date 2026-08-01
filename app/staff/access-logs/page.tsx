import { createClient } from "@/utils/supabase/server";
import {
  getAccessLogsAction,
  getAccessStatsAction,
  getLibraryHoursAction,
} from "./actions";
import { AccessLogClient } from "./components/access-log-client";

export const metadata = {
  title: "การเข้าใช้ห้องสมุด",
};

/**
 * หน้าการเข้าใช้ห้องสมุด (/staff/access-logs)
 * - layout.tsx จัด Header/Sidebar/Footer + auth guard (staff/admin) ให้แล้ว
 * - หน้านี้ตรวจ user อีกครั้ง แล้วดึงข้อมูลเริ่มต้น (logs + stats + เวลาเปิด-ปิด) ส่งให้ AccessLogClient
 */
export default async function StaffAccessLogsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // ดึงข้อมูลเริ่มต้นพร้อมกัน
  const [logsResult, statsResult, hoursResult] = await Promise.all([
    getAccessLogsAction(),
    getAccessStatsAction(),
    getLibraryHoursAction(),
  ]);

  return (
    <AccessLogClient
      initialLogs={logsResult.data ?? []}
      initialStats={
        statsResult.data ?? {
          currentlyIn: 0,
          todayCount: 0,
          monthCount: 0,
          avgDurationMin: 0,
        }
      }
      initialHours={hoursResult.data ?? []}
    />
  );
}