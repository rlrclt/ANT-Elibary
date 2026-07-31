import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProfileClient } from "./components/profile-client";
import { getDropdownOptionsAction } from "@/app/staff/settings/dropdowns/actions";

export const metadata: Metadata = {
  title: "โปรไฟล์ของฉัน",
};

/**
 * หน้าโปรไฟล์สมาชิก (/member/profile)
 * Server component — ตรวจสอบ session และดึงข้อมูล profile จาก public.users
 * แล้วส่งให้ ProfileClient จัดการ UI + tabs
 */
export default async function MemberProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileRes, dropdownsRes] = await Promise.all([
    supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle(),
    getDropdownOptionsAction(),
  ]);

  const profile = profileRes.data;

  if (!profile) {
    redirect("/login");
  }

  return (
    <ProfileClient
      initialProfile={{
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email ?? user.email ?? "",
        phone: profile.phone ?? "",
        department: profile.department ?? "",
        class_level: profile.class_level ?? "",
        class_number: profile.class_number ?? "",
        address: profile.address ?? "",
        avatar_url: profile.avatar_url ?? "",
        user_id_code: profile.user_id_code,
        role: profile.role,
        fine_balance: profile.fine_balance ?? 0,
        borrow_limit: profile.borrow_limit ?? 5,
        created_at: profile.created_at,
        user_type: profile.user_type,
        department_id: profile.department_id,
        class_level_id: profile.class_level_id,
        room_level_id: profile.room_level_id,
        room_level: profile.room_level ?? "",
        class_group_id: profile.class_group_id,
        class_group: profile.class_group,
        gender: profile.gender ?? "not_specified",
      }}
      userEmail={user.email ?? null}
      departments={dropdownsRes.departments || []}
      classLevels={dropdownsRes.classLevels || []}
      roomLevels={dropdownsRes.roomLevels || []}
      classGroups={dropdownsRes.classGroups || []}
    />
  );
}