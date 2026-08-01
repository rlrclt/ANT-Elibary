import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * GET /api/access/auto-checkout
 * ปิด session เช็คอินที่เกินเวลาปิดห้องสมุดอัตโนมัติ (เรียกทุก X นาที ผ่าน Vercel Cron)
 *
 * flow:
 *   1. ใช้ admin client (service_role) เรียก RPC auto_close_expired_sessions()
 *      ซึ่งเป็น SECURITY DEFINER → ข้าม RLS ได้โดยไม่ต้องอิง session ผู้ใช้
 *   2. ถ้า feature ยังไม่พร้อม (ตาราง/ฟังก์ชันยังไม่มี) → คืน ok: true แบบเงียบ ๆ
 *
 * ความปลอดภัย: ตรวจ CRON_SECRET เหมือน /api/line/dispatch
 *   - Vercel Cron: request ภายใน → ต้องตรง CRON_SECRET
 *   - ถ้าไม่ตั้ง CRON_SECRET → อนุญาตทุกคน (development mode)
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const provided = authHeader?.replace("Bearer ", "");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("auto_close_expired_sessions");

    if (error) {
      // ฟังก์ชันยังไม่มี (ยังไม่รัน migration) — ไม่ใช่ความผิดปกติร้ายแรง
      console.error("[access-auto-checkout] rpc error:", error.message);
      return NextResponse.json({ ok: true, closed: 0, skipped: true });
    }

    return NextResponse.json({ ok: true, closed: data ?? 0, skipped: false });
  } catch (err: any) {
    console.error("[access-auto-checkout] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
