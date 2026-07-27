import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProfileClient } from "./components/profile-client";

export const metadata: Metadata = {
  title: "โปรไลล์ของฉัน",
};

/**
 * หน้าโปรไลล์สมาชิก (/member/profile)
 * Server component — ตรวจสอบ session และดึงข้อมูล profile จาก public.users
 * แล้วส่งให้ ProfileClient จัดการ UI + tabs
 */
export default async function MemberProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

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
      }}
      userEmail={user.email ?? null}
    />
  );
}