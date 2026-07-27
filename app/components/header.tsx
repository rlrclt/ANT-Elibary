"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PhosphorIcon } from "./phosphor-icon";
import { ThemeToggle } from "./theme-toggle";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";

/**
 * Header หลัก (สีเขียวแบรนด์ sticky)
 * แสดงปุ่มตามสถานะล็อกอิน:
 * - ยังไม่ล็อกอิน: ปุ่ม "เข้าสู่ระบบ"
 * - ล็อกอินแล้ว: ปุ่ม "แดชบอร์ด" และ "ออกจากระบบ"
 */
const AUTH_PATHS = ["/login", "/register"];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = AUTH_PATHS.includes(pathname);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // ดึง user ปัจจุบัน
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // ฟังเหตุการณ์การเปลี่ยนสถานะล็อกอิน
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-meb-green text-white h-16 shadow-md">
      <div className="max-w-[1200px] mx-auto h-full px-4 flex items-center justify-between gap-4">
        {/* โลโก้ */}
        <Link
          href="/"
          className="flex items-center gap-2 text-white hover:text-white/90 shrink-0 focus:outline-none focus:ring-2 focus:ring-white rounded"
        >
          <PhosphorIcon name="buildings" weight="fill" className="text-3xl" />
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight leading-none mt-1">
              วิทยาลัยเทคนิคอำนาจเจริญ
            </span>
            <span className="text-[10px] tracking-wider uppercase">E-Library</span>
          </div>
        </Link>

        {/* ปุ่มตามสถานะ Auth */}
        {!loading && (
          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
            {user ? (
              <>
                <Link
                  href="/member"
                  className="inline-flex items-center justify-center gap-2 bg-white text-meb-green font-bold px-4 py-2 rounded-md text-sm hover:bg-meb-light transition shadow-sm"
                >
                  <PhosphorIcon name="user" weight="bold" />
                  แดชบอร์ด
                </Link>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center justify-center gap-1 bg-meb-dark/40 hover:bg-meb-dark/70 text-white font-medium px-3 py-2 rounded-md text-sm transition"
                  title="ออกจากระบบ"
                >
                  <PhosphorIcon name="sign-out" weight="bold" />
                  <span className="hidden sm:inline">ออกจากระบบ</span>
                </button>
              </>
            ) : (
              !isAuthPage && (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-white text-meb-green font-bold px-4 py-2 rounded-md text-sm hover:bg-meb-light transition shadow-sm"
                >
                  เข้าสู่ระบบ
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </header>
  );
}