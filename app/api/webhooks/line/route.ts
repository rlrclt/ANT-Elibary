import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { dispatchLineNotifications } from "@/utils/line-notify";

/**
 * LINE Webhook — รับ events จาก LINE Messaging API
 *
 * ใช้ตอนตั้งค่าใน LINE Developers Console:
 *   Webhook URL: https://your-domain.com/api/webhooks/line
 *
 * รองรับ events:
 *   - follow: user เพิ่ม bot เป็นเพื่อน → ส่งข้อความต้อนรับ + ลิงก์เชื่อมบัญชี
 *   - unfollow: user บล็อก bot → ลบ line_user_id ออกจาก users
 *   - message: user พิมพ์ "เชื่อม" หรือ "link" → ส่งลิงก์ LIFF
 *
 * หมายเหตุ: ใช้ X-Line-Signature เพื่อยืนยันความถูกต้องของ request
 */

/** ยืนยัน signature จาก LINE */
function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || secret === "YOUR_LINE_CHANNEL_SECRET") return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

/** ส่ง reply message ผ่าน LINE */
async function replyMessage(replyToken: string, messages: any[]): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || token === "YOUR_LINE_CHANNEL_ACCESS_TOKEN") return;

  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ replyToken, messages }),
    });
  } catch (err) {
    console.error("[line-webhook] reply error:", err);
  }
}

/** สร้างลิงก์ LIFF สำหรับเชื่อมบัญชี */
function getLiffUrl(): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId || liffId === "1234567890-AbCdEfGh") {
    return "https://your-domain.com/line/link";
  }
  return `https://liff.line.me/${liffId}`;
}

/** ลบ line_user_id ออกจาก users เมื่อ user บล็อก bot */
async function unlinkLineUser(lineUserId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("users")
    .update({ line_user_id: null })
    .eq("line_user_id", lineUserId);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  // ยืนยัน signature
  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = parsed.events ?? [];

  // ประมวลผลแบบ async (ไม่บล็อก response 200 กลับ LINE เร็วๆ)
  const tasks = events.map(async (ev: any) => {
    const type = ev.type;
    const source = ev.source;
    const lineUserId = source?.userId;

    if (!lineUserId) return;

    if (type === "follow") {
      // user เพิ่ม bot เป็นเพื่อน → ส่งข้อความต้อนรับ + ลิงก์เชื่อมบัญชี
      const liffUrl = getLiffUrl();
      await replyMessage(ev.replyToken, [
        {
          type: "text",
          text: "ยินดีต้อนรับสู่ ANT E-Library 📚\n\nกดปุ่มด้านล่างเพื่อเชื่อมต่อบัญชี LINE กับระบบ แล้วรับการแจ้งเตือนการยืม-คืนหนังสือผ่าน LINE",
        },
        {
          type: "template",
          altText: "กดเชื่อมต่อบัญชี",
          template: {
            type: "buttons",
            text: "เชื่อมต่อบัญชี",
            actions: [
              {
                type: "uri",
                label: "เชื่อมต่อบัญชี LINE",
                uri: liffUrl,
              },
            ],
          },
        },
      ]);
    } else if (type === "unfollow") {
      // user บล็อก bot → ลบ line_user_id
      await unlinkLineUser(lineUserId);
    } else if (type === "message") {
      // user พิมพ์ข้อความ "เชื่อม" หรือ "link" → ส่งลิงก์ LIFF
      const text = (ev.message?.text ?? "").toLowerCase().trim();
      if (text === "เชื่อม" || text === "link" || text === "เชื่อมต่อ") {
        await replyMessage(ev.replyToken, [
          {
            type: "template",
            altText: "กดเชื่อมต่อบัญชี",
            template: {
              type: "buttons",
              text: "กดเพื่อเชื่อมต่อบัญชี LINE กับระบบ",
              actions: [
                {
                  type: "uri",
                  label: "เชื่อมต่อบัญชี",
                  uri: getLiffUrl(),
                },
              ],
            },
          },
        ]);
      }
    }
  });

  // LINE ต้องการให้ webhook ตอบกลับเร็วมาก ให้ทำงานต่อหลังส่ง response แล้ว
  // เพื่อไม่ให้ LINE แสดง timeout ทั้งที่ event ถูกประมวลผลสำเร็จ
  after(async () => {
    await Promise.allSettled(tasks);

    // ส่ง notification ที่ค้างอยู่ด้วย (best-effort)
    try {
      await dispatchLineNotifications();
    } catch (err) {
      console.error("[line-webhook] dispatch error:", err);
    }
  });

  return NextResponse.json({ ok: true });
}
