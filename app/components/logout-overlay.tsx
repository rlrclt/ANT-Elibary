"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { PhosphorIcon } from "./phosphor-icon";

/**
 * LogoutOverlay — animation ตอนออกจากระบบ
 * - แสดง overlay เต็มจอพร้อม fade-out
 * - ไอคอนหมุน + ข้อความ "กำลังออกจากระบบ..."
 * - หลัง signOut เสร็จ → redirect ไป /login
 *
 * ใช้: เรียก <LogoutOverlay onStart={...} /> หรือใช้ useLogout hook
 */
type LogoutOverlayProps = {
  /** เริ่ม animation เมื่อ true */
  active: boolean;
  /** callback หลัง signOut เสร็จ (default: redirect /login) */
  onComplete?: () => void;
};

export function LogoutOverlay({ active, onComplete }: LogoutOverlayProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "signing-out" | "fading" | "done">("idle");

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }

    let cancelled = false;
    setPhase("signing-out");

    async function run() {
      const supabase = createClient();
      await supabase.auth.signOut();

      if (cancelled) return;
      setPhase("fading");

      // รอ animation fade-out 500ms แล้ว redirect
      setTimeout(() => {
        if (cancelled) return;
        setPhase("done");
        if (onComplete) {
          onComplete();
        } else {
          router.push("/login");
          router.refresh();
        }
      }, 600);
    }

    run();
    return () => { cancelled = true; };
  }, [active, onComplete, router]);

  if (phase === "idle") return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-500 ${
        phase === "fading" || phase === "done" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Backdrop มืด */}
      <div className="absolute inset-0 bg-forest dark:bg-black/80 backdrop-blur-sm" />

      {/* เนื้อหากลางจอ */}
      <div className="relative flex flex-col items-center gap-4 text-white">
        {/* ไอคอนวงกลมหมุน */}
        <div className="relative">
          {/* วงแหวนนอกหมุน */}
          <div className="w-20 h-20 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          {/* ไอคอน sign-out กลาง */}
          <div className="absolute inset-0 flex items-center justify-center">
            <PhosphorIcon
              name="sign-out"
              weight="fill"
              className="text-2xl text-white"
            />
          </div>
        </div>

        {/* ข้อความ */}
        <div className="text-center">
          <p className="text-lg font-bold animate-pulse">กำลังออกจากระบบ...</p>
          <p className="text-sm text-white/60 mt-1">อาจใช้เวลาสักครู่</p>
        </div>

        {/* แถบความคืบหน้า */}
        <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-meb-green rounded-full animate-[logout-progress_1s_ease-in-out_forwards]" />
        </div>
      </div>

      {/* CSS keyframes สำหรับแถบความคืบหน้า */}
      <style>{`
        @keyframes logout-progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}

/**
 * useLogout — hook สำหรับเริ่ม animation ออกจากระบบ
 * ใช้: const { loggingOut, triggerLogout } = useLogout();
 * เรียก triggerLogout() ตอนกดปุ่มออกจากระบบ
 */
export function useLogout() {
  const [loggingOut, setLoggingOut] = useState(false);

  function triggerLogout() {
    setLoggingOut(true);
  }

  return { loggingOut, triggerLogout };
}