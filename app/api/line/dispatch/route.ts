import { NextRequest, NextResponse } from "next/server";
import {
  dispatchLineNotifications,
  checkDueDateReminders,
  checkPendingReturnReminders,
} from "@/utils/line-notify";

/**
 * GET /api/line/dispatch
 * ส่ง LINE notification ที่ค้างอยู่ใน notification_queue (status='pending')
 * + ตรวจหนังสือใกล้ครบกำหนดคืนและ enqueue reminder
 * + ตรวจคำขอกลืนคืนที่ค้างเกิน 7 วัน → แจ้งเตือนเจ้าหน้าที่
 *
 * ใช้สำหรับ Vercel Cron (เรียกทุก 1 นาที ผ่าน vercel.json crons config)
 * หรือ external cron service ที่ส่ง Authorization: Bearer <CRON_SECRET>
 *
 * ความปลอดภัย:
 *   - Vercel Cron ส่ง request ภายใน Vercel เอง (ไม่ต้อง secret)
 *   - External request ต้องส่ง CRON_SECRET ใน Authorization header
 *   - ถ้าไม่ตั้ง CRON_SECRET → อนุญาตทุกคน (development mode)
 *
 * flow:
 *   1. Server Action บันทึก queue (pending) + after() ส่ง LINE ทันที
 *   2. ถ้า after() ส่งสำเร็จ → status='sent' (ไม่ต้องรอ cron)
 *   3. ถ้า after() ส่งไม่สำเร็จ → คง pending ให้ cron ดึงมา retry
 *   4. cron เรียก endpoint นี้:
 *      a. checkDueDateReminders() — ตรวจ due_date ใกล้ครบ → enqueue reminder
 *      b. checkPendingReturnReminders() — ตรวจคำขอกลืนคืนค้างเกิน 7 วัน → แจ้ง staff
 *      c. dispatchLineNotifications() — ดึง pending มาส่งใหม่
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
    // 1. ตรวจหนังสือใกล้ครบกำหนด → enqueue reminder (best-effort)
    let reminders = { enqueued: 0 };
    try {
      reminders = await checkDueDateReminders();
    } catch (err) {
      console.error("[line-dispatch] reminder check error:", err);
    }

    // 2. ตรวจคำขอกลืนคืนค้างเกิน 7 วัน → แจ้งเจ้าหน้าที่ (best-effort)
    let pendingReturns = { enqueued: 0 };
    try {
      pendingReturns = await checkPendingReturnReminders();
    } catch (err) {
      console.error("[line-dispatch] pending return check error:", err);
    }

    // 3. ส่ง LINE notification ที่ค้างอยู่ (รวม reminder ที่เพิ่ง enqueue)
    const result = await dispatchLineNotifications();

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      remindersEnqueued: reminders.enqueued,
      pendingReturnRemindersEnqueued: pendingReturns.enqueued,
    });
  } catch (err: any) {
    console.error("[line-dispatch] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}