import { createClient } from "@/utils/supabase/server";
import { getDropdownOptionsAction } from "@/app/staff/settings/dropdowns/actions";
import { GroupsClient } from "./components/groups-client";

export const metadata = {
  title: "เจาะกลุ่มเรียน",
};

/**
 * หน้าเจาะกลุ่มเรียน (/staff/groups)
 * - layout.tsx จัด Header/Sidebar/Footer + auth guard ให้แล้ว
 * - หน้านี้ดึงข้อมูลตัวเลือก (ปีการศึกษา/แผนก/ระดับชั้น/รหัสกลุ่มเรียน)
 *   แล้วส่งให้ GroupsClient เลือกลดหลั่นและแสดงสมาชิกในกลุ่ม
 */
export default async function StaffGroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dropdowns = await getDropdownOptionsAction();

  return (
    <GroupsClient
      departments={dropdowns.departments || []}
      classLevels={dropdowns.classLevels || []}
      classGroups={dropdowns.classGroups || []}
    />
  );
}
