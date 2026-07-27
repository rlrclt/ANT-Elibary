import { NextRequest, NextResponse } from "next/server";
import { dispatchLineNotifications } from "@/utils/line-notify";

/**
 * GET /api/line/dispatch
 * ส่ง LINE notification ที่ค้างอยู่ (line_sent_at IS NULL)
 *
 * ใช้สำหรับ Vercel Cron (เรียกทุก 1 นาที ผ่าน vercel.json crons config)
 * หรือ external cron service ที่ส่ง Authorization: Bearer <CRON_SECRET>
 *
 * ความปลอดภัย:
 *   - Vercel Cron ส่ง request ภายใน Vercel เอง (ไม่ต้อง secret)
 *   - External request ต้องส่ง CRON_SECRET ใน Authorization header
 *   - ถ้าไม่ตั้ง CRON_SECRET → อนุญาตทุกคน (development mode)
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    // ตรวจสอบ Authorization header
    const authHeader = req.headers.get("authorization");
    const provided = authHeader?.replace("Bearer ", "");

    // Vercel Cron ส่ง request ภายในระบบ — ตรวจด้วย CRON_SECRET
    // ถ้าไม่ตรง → ปฏิเสธ
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await dispatchLineNotifications();
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err: any) {
    console.error("[line-dispatch] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}