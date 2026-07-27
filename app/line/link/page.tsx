"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { createLineLinkTokenAction } from "../actions";

/**
 * LIFF Link Page — หน้าที่เปิดในแอป LINE (LIFF)
 * URL: https://liff.line.me/{LIFF_ID}
 *
 * flow:
 *   1. liff.init() → ดึง line_user_id + display_name
 *   2. สร้าง token (createLineLinkTokenAction)
 *   3. redirect ไป /line/claim?token=xxx ในเบราว์เซอร์ปกติ
 */
export default function LiffLinkPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    async function initLiff() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId || liffId === "1234567890-AbCdEfGh") {
        setStatus("error");
        setErrorMsg("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID");
        return;
      }

      try {
        await liff.init({ liffId });

        // ถ้ายังไม่ได้ login ใน LINE → เรียก liff.login()
        if (!liff.isLoggedIn()) {
          liff.login();
          return; // รอ redirect กลับมาหลัง login
        }

        // ดึง profile (หลัง login แล้ว)
        const profile = await liff.getProfile();
        const lineUserId = profile.userId;
        const displayName = profile.displayName;

        // สร้าง token
        const { token, error } = await createLineLinkTokenAction(
          lineUserId,
          displayName,
        );

        if (error || !token) {
          setStatus("error");
          setErrorMsg(error ?? "สร้าง token ไม่สำเร็จ");
          return;
        }

        // redirect ไปหน้า claim (ในเบราว์เซอร์ปกติ)
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
        const claimUrl = `${appUrl}/line/claim?token=${token}`;
        setRedirecting(true);
        window.location.href = claimUrl;
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err?.message ?? "LIFF init ล้มเหลว");
      }
    }

    initLiff();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-meb-light to-white dark:from-card-bg dark:to-card-bg flex items-center justify-center p-4">
      <div className="bg-white dark:bg-card-bg rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-meb-green flex items-center justify-center text-white text-3xl">
          📚
        </div>

        <h1 className="text-xl font-bold text-forest dark:text-slate-100 mb-2">
          ANT E-Library
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          ระบบห้องสมุดดิจิทัล วิทยาลัยเทคนิคอำนาจเจริญ
        </p>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-meb-light border-t-meb-green rounded-full animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {redirecting
                ? "กำลังเปลี่ยนหน้า..."
                : "กำลังเชื่อมต่อ LINE..."}
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-price-red font-medium mb-2">
              เกิดข้อผิดพลาด
            </p>
            <p className="text-xs text-price-red/80">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}