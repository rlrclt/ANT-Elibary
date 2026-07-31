"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PhosphorIcon } from "@/app/components/phosphor-icon";
import { claimLineLinkTokenAction } from "../actions";

/**
 * Claim Page — หน้าเว็บปกติ ที่ user เข้ามาหลังจาก LIFF redirect
 * URL: /line/claim?token=xxx
 *
 * flow:
 *   1. ถ้าไม่ได้ login → แสดงปุ่ม "เข้าสู่ระบบ" (พาไป /login?redirect=/line/claim?token=xxx)
 *   2. ถ้า login แล้ว → auto-claim token → แสดงผลสำเร็จ
 *   3. สำเร็จ → ปุ่ม "ไปหน้าโปรไฟล์"
 */
function ClaimContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    status: "idle" | "loading" | "success" | "error" | "need-login";
    message: string;
    displayName?: string;
  }>({ status: "idle", message: "" });

  // ตรวจสอบ token และ auto-claim
  useEffect(() => {
    if (!token) {
      setResult({
        status: "error",
        message: "ไม่พบ token ใน URL — กรุณาเริ่มเชื่อมต่อใหม่ผ่าน LINE",
      });
      return;
    }

    // ตรวจสอบ session โดยเรียก claim ตรงๆ (ถ้ายังไม่ login action จะคืน error)
    startTransition(async () => {
      const fd = new FormData();
      fd.set("token", token);
      const res = await claimLineLinkTokenAction(fd);

      if (res.error === "กรุณาเข้าสู่ระบบก่อน") {
        setResult({
          status: "need-login",
          message: "กรุณาเข้าสู่ระบบเพื่อเชื่อมต่อบัญชี LINE",
        });
        return;
      }

      if (res.error) {
        setResult({ status: "error", message: res.error });
        return;
      }

      setResult({
        status: "success",
        message: "เชื่อมต่อบัญชี LINE สำเร็จ! ตอนนี้คุณจะได้รับการแจ้งเตือนผ่าน LINE",
        displayName: res.lineDisplayName,
      });
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-meb-light to-white dark:from-card-bg dark:to-card-bg flex items-center justify-center p-4">
      <div className="bg-white dark:bg-card-bg rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Logo */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-meb-green flex items-center justify-center text-white text-2xl">
          📚
        </div>

        <h1 className="text-xl font-bold text-forest dark:text-slate-100 text-center mb-1">
          ANT E-Library
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          เชื่อมต่อบัญชี LINE
        </p>

        {/* Loading */}
        {(result.status === "idle" || result.status === "loading" || pending) && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-10 h-10 border-4 border-meb-light border-t-meb-green rounded-full animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              กำลังเชื่อมต่อ...
            </p>
          </div>
        )}

        {/* ต้อง login ก่อน */}
        {result.status === "need-login" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
              <PhosphorIcon name="user-circle" weight="fill" className="text-3xl" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
              {result.message}
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/line/claim?token=${token}`)}`}
              className="inline-flex items-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-2.5 rounded-md text-sm transition"
            >
              <PhosphorIcon name="sign-in" weight="bold" />
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {/* สำเร็จ */}
        {result.status === "success" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-meb-light flex items-center justify-center text-meb-green animate-bounce">
              <PhosphorIcon name="check-circle" weight="fill" className="text-3xl" />
            </div>
            <p className="text-sm font-bold text-meb-green text-center">
              {result.message}
            </p>
            {result.displayName && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                LINE: {result.displayName}
              </p>
            )}
            <button
              onClick={() => router.push("/member/profile")}
              className="inline-flex items-center gap-2 bg-meb-green hover:bg-meb-hover text-white font-bold px-6 py-2.5 rounded-md text-sm transition"
            >
              <PhosphorIcon name="user" weight="bold" />
              ไปหน้าโปรไฟล์
            </button>
          </div>
        )}

        {/* ผิดพลาด */}
        {result.status === "error" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-price-red">
              <PhosphorIcon name="x-circle" weight="fill" className="text-3xl" />
            </div>
            <p className="text-sm text-price-red text-center">{result.message}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-meb-green hover:underline"
            >
              <PhosphorIcon name="arrow-left" weight="bold" />
              กลับหน้าหลัก
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-meb-light border-t-meb-green rounded-full animate-spin" />
        </div>
      }
    >
      <ClaimContent />
    </Suspense>
  );
}