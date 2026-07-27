import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PhosphorIcon } from "../../components/phosphor-icon";
import { Header } from "../../components/header";
import { SimpleFooter } from "../../components/simple-footer";

export const metadata = {
  title: "ยืนยันอีเมล — ANT E-Library",
};

/**
 * หน้าแจ้งผลหลังคลิกลิงก์ยืนยันอีเมลจาก Supabase
 * - สำเร็จ: โชว์ข้อความเชิญไป login
 * - หมดอายุ/ผิดพลาด: โชว์ error + ปุ่มขอลิงก์ใหม่
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; description?: string }>;
}) {
  const params = await searchParams;
  const isError = Boolean(params.error);

  // ถ้ามี session อยู่แล้วแสดงว่ายืนยันสำเร็จ → ดึง user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // แปลงรายละเอียด Error ให้เข้าใจง่ายสำหรับผู้ใช้ทั่วไป
  const getFriendlyErrorMessage = () => {
    if (params.error === "otp_expired") {
      return "ลิงก์ยืนยันอีเมลหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่";
    }

    const desc = params.description?.toLowerCase() ?? "";
    if (desc.includes("code verifier") || params.error === "exchange_failed") {
      return "ไม่พบรหัสยืนยันเบราว์เซอร์ (PKCE code verifier) เหตุการณ์นี้มักเกิดขึ้นเมื่อคุณเปิดลิงก์ยืนยันในคนละแอปพลิเคชันหรือคนละเบราว์เซอร์กับเบราว์เซอร์เดิมที่คุณใช้สมัครสมาชิก (เช่น สมัครใน Chrome แต่เปิดอีเมลแล้วลิงก์เด้งไปเปิดใน Safari)\n\nวิธีแก้ไข: กรุณาคัดลอกลิงก์จากอีเมลไปเปิดในเบราว์เซอร์เดิมที่คุณใช้สมัครสมาชิก หรือสมัครใหม่อีกครั้ง";
    }

    if (params.error === "verification_failed") {
      return "การยืนยันรหัสความปลอดภัยไม่สำเร็จ ลิงก์อาจจะหมดอายุหรือถูกใช้งานไปแล้ว";
    }

    return params.description || "เกิดข้อผิดพลาดในการยืนยันอีเมล กรุณาลองอีกครั้ง";
  };

  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-cream">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          {isError ? (
            <>
              <div className="w-14 h-14 mx-auto rounded-full bg-price-red/10 flex items-center justify-center text-price-red text-3xl mb-5">
                <PhosphorIcon name="warning-circle" weight="fill" />
              </div>
              <h1 className="text-xl font-bold text-forest mb-2">
                ลิงก์ยืนยันไม่สำเร็จ
              </h1>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed whitespace-pre-line">
                {getFriendlyErrorMessage()}
              </p>
              <Link
                href="/register"
                className="btn-cta inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-5 py-2.5 rounded-md text-sm shadow-sm"
              >
                กลับไปสมัครใหม่
                <PhosphorIcon name="arrow-right" />
              </Link>
            </>
          ) : user ? (
            // มี session แล้ว — ยืนยันสำเร็จ + login พร้อม
            <>
              <div className="w-14 h-14 mx-auto rounded-full bg-meb-light flex items-center justify-center text-meb-green text-3xl mb-5">
                <PhosphorIcon name="check-circle" weight="fill" />
              </div>
              <h1 className="text-xl font-bold text-forest mb-2">
                ยืนยันอีเมลสำเร็จ
              </h1>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                ยินดีต้อนรับเข้าสู่ ANT E-Library!
                บัญชีของคุณพร้อมใช้งานแล้ว
              </p>
              <Link
                href="/member"
                className="btn-cta spotlight inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-5 py-2.5 rounded-md text-sm shadow-sm"
              >
                ไปที่แดชบอร์ด
                <PhosphorIcon name="arrow-right" />
              </Link>
            </>
          ) : (
            // ยืนยันสำเร็จแต่ยังไม่ได้ login → ไป login
            <>
              <div className="w-14 h-14 mx-auto rounded-full bg-meb-light flex items-center justify-center text-meb-green text-3xl mb-5">
                <PhosphorIcon name="check-circle" weight="fill" />
              </div>
              <h1 className="text-xl font-bold text-forest mb-2">
                ยืนยันอีเมลสำเร็จ
              </h1>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่คุณสมัครไว้
              </p>
              <Link
                href="/login"
                className="btn-cta spotlight inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-hover text-white font-bold px-5 py-2.5 rounded-md text-sm shadow-sm"
              >
                เข้าสู่ระบบ
                <PhosphorIcon name="arrow-right" />
              </Link>
            </>
          )}
        </div>
      </main>
      <SimpleFooter />
    </>
  );
}