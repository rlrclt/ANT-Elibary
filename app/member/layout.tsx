import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { MemberHeader } from "./components/member-header";
import { SecondaryNav } from "./components/secondary-nav";
import { MemberFooter } from "./components/member-footer";

export const metadata: Metadata = {
  title: {
    default: "สมาชิก — ANT E-Library",
    template: "%s — ANT E-Library",
  },
};

/**
 * MemberLayout — ครอบทุกหน้า /member/*
 * - ตรวจ session (getUser)
 * - ถ้า !user → redirect("/login")
 * - ดึง profile จาก public.users (full_name, user_id_code, avatar_url, role)
 * - อนุญาตให้ staff/admin เข้าใช้งานส่วน member ได้ (แต่ member เข้า /staff ไม่ได้)
 * - เรนเดอร์ Header + SecondaryNav + main + Footer
 */
export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, user_id_code, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  // fallback ถ้าไม่มี profile
  const fullName = profile?.full_name ?? "สมาชิก";
  const userIdCode = profile?.user_id_code ?? "—";
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-page-bg dark:bg-page-bg transition-colors duration-300">
      <MemberHeader
        fullName={fullName}
        userIdCode={userIdCode}
        avatarUrl={avatarUrl}
      />
      <SecondaryNav />
      <main className="flex-1 max-w-[1200px] mx-auto px-4 py-6 space-y-6 w-full">
        {children}
      </main>
      <MemberFooter />
    </div>
  );
}