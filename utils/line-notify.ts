import { createAdminClient } from "@/utils/supabase/admin";

/**
 * LINE Notify Library — ส่งข้อความผ่าน LINE Messaging API
 *
 * flow:
 *   1. ดึง system_notifications ที่ line_sent_at IS NULL
 *   2. กรองเฉพาะ user ที่มี line_user_id
 *   3. ส่งข้อความผ่าน LINE Push API
 *   4. UPDATE line_sent_at = now()
 *
 * ใช้ admin client (service_role) เพื่อข้าม RLS
 * ต้องตั้ง LINE_CHANNEL_ACCESS_TOKEN ใน env
 */

const LINE_API_BASE = "https://api.line.me/v2/bot";

/** ดึง LINE Channel Access Token จาก env */
function getAccessToken(): string | null {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t || t === "YOUR_LINE_CHANNEL_ACCESS_TOKEN") return null;
  return t;
}

type PendingNotification = {
  id: string;
  line_user_id: string;
  title: string;
  body: string;
  action_url: string | null;
  icon: string;
  category: string;
};

/**
 * ดึง system_notifications ที่ยังไม่ได้ส่ง LINE + user มี line_user_id
 * จำกัด 20 รายการต่อรอบ
 */
async function getPendingNotifications(): Promise<PendingNotification[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("system_notifications")
    .select(
      `id, title, body, action_url, icon, category,
       users!inner ( line_user_id )`,
    )
    .is("line_sent_at", null)
    .not("users.line_user_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[line-notify] query error:", error.message);
    return [];
  }

  return ((data ?? []) as any[]).map((n) => ({
    id: n.id,
    line_user_id: n.users.line_user_id,
    title: n.title,
    body: n.body,
    action_url: n.action_url,
    icon: n.icon,
    category: n.category,
  }));
}

/** แปลง icon ของ Phosphor → emoji LINE (เพราะ LINE ไม่รองรับ Phosphor) */
function iconToEmoji(icon: string): string {
  const map: Record<string, string> = {
    "book-open": "📚",
    book: "📖",
    "door-open": "🚪",
    door: "🏠",
    "warning-circle": "⚠️",
    warning: "⚠️",
    clock: "⏰",
    prohibit: "🚫",
    at: "📧",
    bell: "🔔",
    "bell-ringing": "🔔",
  };
  return map[icon] ?? "🔔";
}

/** สร้าง Flex Message สำหรับ LINE */
function buildFlexMessage(n: PendingNotification) {
  const emoji = iconToEmoji(n.icon);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    type: "flex",
    altText: `${emoji} ${n.title}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#00A651",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: `${emoji} ${n.title}`,
            color: "#FFFFFF",
            weight: "bold",
            size: "md",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: n.body,
            size: "sm",
            color: "#333333",
            wrap: true,
          },
        ],
      },
      ...(n.action_url
        ? {
            footer: {
              type: "box",
              layout: "vertical",
              paddingAll: "8px",
              contents: [
                {
                  type: "button",
                  action: {
                    type: "uri",
                    label: "ดูรายละเอียด",
                    uri: n.action_url.startsWith("http")
                      ? n.action_url
                      : `${appUrl}${n.action_url}`,
                  },
                  style: "primary",
                  color: "#00A651",
                },
              ],
            },
          }
        : {}),
    },
  };
}

/** ส่ง Push Message ไปยัง LINE userId คนหนึ่ง */
async function pushToUser(
  lineUserId: string,
  messages: any[],
): Promise<boolean> {
  const token = getAccessToken();
  if (!token) {
    console.warn("[line-notify] LINE_CHANNEL_ACCESS_TOKEN not set");
    return false;
  }

  try {
    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[line-notify] push failed (${res.status}):`,
        errText.slice(0, 200),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[line-notify] push error:", err);
    return false;
  }
}

/** ทำเครื่องหมายว่าส่ง LINE สำเร็จแล้ว */
async function markSent(notificationId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("system_notifications")
    .update({ line_sent_at: new Date().toISOString() })
    .eq("id", notificationId);
}

/**
 * dispatch — ส่ง LINE notification ที่ค้างอยู่ทั้งหมด
 * เรียกจาก: cron, webhook, หรือ server action หลังเกิด event
 * คืนจำนวนที่ส่งสำเร็จ
 */
export async function dispatchLineNotifications(): Promise<{
  sent: number;
  failed: number;
}> {
  const pending = await getPendingNotifications();
  if (pending.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  // รวมตาม line_user_id เพื่อส่งเป็น batch (LINE จำกัด 5 ข้อความ/push)
  const byUser = new Map<string, PendingNotification[]>();
  for (const n of pending) {
    const arr = byUser.get(n.line_user_id) ?? [];
    arr.push(n);
    byUser.set(n.line_user_id, arr);
  }

  for (const [lineUserId, notifs] of byUser.entries()) {
    // ส่งทีละรายการ (เพื่อ mark sent แยกได้)
    for (const n of notifs) {
      const ok = await pushToUser(lineUserId, [buildFlexMessage(n)]);
      if (ok) {
        await markSent(n.id);
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, failed };
}

/**
 * sendToUser — ส่งข้อความไปยัง LINE userId คนหนึ่งทันที (inline)
 * ใช้ตอนเกิด event โดยตรง (เช่น ใน server action หลังยืม)
 * ไม่ได้ผ่าน system_notifications
 */
export async function sendLineMessage(
  lineUserId: string,
  title: string,
  body: string,
  actionUrl?: string | null,
  icon: string = "bell",
): Promise<boolean> {
  return pushToUser(lineUserId, [
    buildFlexMessage({
      id: "inline",
      line_user_id: lineUserId,
      title,
      body,
      action_url: actionUrl ?? null,
      icon,
      category: "loan",
    }),
  ]);
}

/**
 * sendToSystemUser — ส่ง LINE ไปยัง user ของระบบ (UUID)
 * ดึง line_user_id จาก public.users แล้วส่ง
 */
export async function sendToSystemUser(
  userId: string,
  title: string,
  body: string,
  actionUrl?: string | null,
  icon: string = "bell",
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("line_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (!data?.line_user_id) return false;
  return sendLineMessage(data.line_user_id, title, body, actionUrl, icon);
}