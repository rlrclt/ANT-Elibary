import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { SettingsClient } from "./components/settings-client";

export const metadata: Metadata = {
  title: "ตั้งค่าบัญชี",
};

/**
 * หน้าตั้งค่าบัญชีเจ้าหน้าที่ (/staff/settings)
 * Server component — ตรวจสอบ session และดึงข้อมูล profile จาก public.users
 * แล้วส่งให้ SettingsClient จัดการ UI + tabs
 */
export default async function StaffSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return (
    <SettingsClient
      initialProfile={{
        id: profile.id,
        full_name: profile.full_name,
        user_id_code: profile.user_id_code,
        email: profile.email ?? user.email ?? "",
        phone: profile.phone ?? "",
        department: profile.department ?? "",
        class_level: profile.class_level ?? "",
        class_number: profile.class_number ?? "",
        address: profile.address ?? "",
        avatar_url: profile.avatar_url ?? "",
        role: profile.role,
        fine_balance: profile.fine_balance ?? 0,
        created_at: profile.created_at,
      }}
      userEmail={user.email ?? null}
    />
  );
}