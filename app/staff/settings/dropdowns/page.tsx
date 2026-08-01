import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getDropdownOptionsAction } from "./actions";
import { DropdownClient } from "./components/dropdown-client";

export const metadata: Metadata = {
  title: "จัดการข้อมูลตัวเลือก — ANT E-Library",
};

/**
 * หน้าจัดการข้อมูลตัวเลือกสำหรับแอดมิน (/staff/settings/dropdowns)
 * เฉพาะผู้ใช้ที่มีบทบาทเป็น 'admin' เท่านั้นที่สามารถเข้าถึงได้
 */
export default async function DropdownSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // จำกัดสิทธิ์เฉพาะ admin
  if (!profile || profile.role !== "admin") {
    redirect("/staff");
  }

  // ดึงข้อมูลตัวเลือกตั้งต้น
  const { departments, classLevels, roomLevels, classGroups, accessPurposes, error } =
    await getDropdownOptionsAction();

  return (
    <DropdownClient
      initialDepartments={departments}
      initialClassLevels={classLevels}
      initialRoomLevels={roomLevels}
      initialClassGroups={classGroups || []}
      initialAccessPurposes={accessPurposes || []}
      initialError={error}
    />
  );
}
