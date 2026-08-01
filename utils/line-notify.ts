import { createAdminClient } from "@/utils/supabase/admin";

/**
 * LINE Notify Library — ส่งข้อความผ่าน LINE Messaging API
 *
 * สถาปัตยกรรม: Server Action + after() + Notification Queue + Retry
 *
 * flow:
 *   1. Server Action บันทึกข้อมูล + INSERT notification_queue (status='pending')
 *   2. after(() => sendQueuedLineNotification(queueId)) ส่งทันทีหลัง response
 *      - ส่งสำเร็จ → status='sent'
 *      - ส่งไม่สำเร็จ → คง status='pending' พร้อม attempts + last_attempt_at
 *   3. Cron (/api/line/dispatch) ดึง pending มาส่งใหม่จนกว่าจะสำเร็จ
 *
 * ใช้ admin client (service_role) เพื่อข้าม RLS
 * ต้องตั้ง LINE_CHANNEL_ACCESS_TOKEN ใน env
 *
 * Flex Message templates อ้างอิงจาก meb-design-system:
 *   - BorrowSuccessUI  → ยืมหนังสือสำเร็จ
 *   - ReturnSuccessUI   → คืนหนังสือสำเร็จ
 *   - ReturnReminderUI  → ใกล้ครบกำหนดคืน
 *   - RenewSuccessUI    → ต่ออายุการยืมสำเร็จ
 */

const LINE_API_BASE = "https://api.line.me/v2/bot";

// สีธีมหลัก (จาก HTML templates)
const COLORS = {
  primary: "#09254c", // Dark blue
  secondary: "#2e96a8", // Teal
  success: "#10b981", // Emerald
  warning: "#ef4444", // Red
  warningBg: "#fef2f2", // Light red
  renew: "#3b82f6", // Blue
  renewBg: "#eff6ff", // Light blue
  textDark: "#1e293b",
  textLight: "#64748b",
  border: "#e2e8f0",
};

/** ดึง LINE Channel Access Token จาก env */
function getAccessToken(): string | null {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t || t === "YOUR_LINE_CHANNEL_ACCESS_TOKEN") return null;
  return t;
}

// ---------- Types ----------
export type NotificationPayload = {
  title: string;
  body: string;
  action_url?: string | null;
  icon?: string;
  category?: string;
  // ข้อมูลเพิ่มเติมสำหรับ Flex Message แบบใหม่
  template?: "borrow" | "return" | "reminder" | "renew";
  member_name?: string;
  book_title?: string;
  book_copy_no?: string | number;
  borrow_date?: string;
  due_date?: string;
  return_date?: string;
  old_due_date?: string;
  new_due_date?: string;
  days_remaining?: number;
  days_extended?: number;
  extension_count?: number;
  extension_limit?: number;
  fine_amount?: number;
  ref_id?: string; // id ของ borrow_record (สำหรับเช็ค reminder ซ้ำ)
};

/** แปลง icon ของ Phosphor → emoji LINE */
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

// ==========================================================
// Flex Message Templates (อิงจาก HTML templates)
// ==========================================================

/** สร้างข้อมูลรายการแบบ list item (icon + label + value) */
function dataItem(
  icon: string,
  label: string,
  value: string,
  valueColor: string = COLORS.primary,
  isLast: boolean = false,
): any {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: icon,
            size: "lg",
            flex: 0,
            margin: "sm",
          },
          {
            type: "text",
            text: label,
            size: "sm",
            color: COLORS.textLight,
            margin: "sm",
          },
        ],
        flex: 1,
      },
      {
        type: "text",
        text: value,
        size: "md",
        weight: "bold",
        color: valueColor,
        flex: 2,
      },
    ],
    margin: isLast ? "none" : "md",
  };
}

/** Footer สำหรับทุก template */
function footerBlock(actionUrl?: string | null): any {
  if (!actionUrl) return undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const uri = actionUrl.startsWith("http")
    ? actionUrl
    : `${appUrl}${actionUrl}`;

  return {
    type: "box",
    layout: "vertical",
    paddingAll: "16px",
    backgroundColor: "#f8fafc",
    contents: [
      {
        type: "button",
        action: {
          type: "uri",
          label: "📋 ดูรายละเอียด →",
          uri,
        },
        style: "primary",
        color: "#2e96a8",
        height: "md",
      },
    ],
  };
}

// ---------- Template: ยืมหนังสือสำเร็จ (BorrowSuccessUI) ----------
function borrowTemplate(n: NotificationPayload): any {
  return {
    type: "flex",
    altText: "📚 ยืมหนังสือสำเร็จ",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: COLORS.primary,
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "📚 ยืมหนังสือ",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            align: "center",
          },
          {
            type: "text",
            text: "สำเร็จ!",
            color: COLORS.secondary,
            weight: "bold",
            size: "xl",
            align: "center",
            margin: "xs",
          },
          {
            type: "text",
            text: "การยืมหนังสือของคุณดำเนินการเรียบร้อยแล้ว",
            color: "#FFFFFFCC",
            size: "xs",
            align: "center",
            margin: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          dataItem("�", "ชื่อผู้ยืม", n.member_name ?? "-"),
          dataItem("📖", "ชื่อหนังสือ", n.book_title ?? "-"),
          dataItem("�", "เล่มที่", String(n.book_copy_no ?? "-")),
          dataItem("📅", "วันที่ยืม", n.borrow_date ?? "-"),
          dataItem("📆", "กำหนดคืน", n.due_date ?? "-", COLORS.warning, true),
        ],
      },
      footer: footerBlock(n.action_url),
    },
  };
}

// ---------- Template: คืนหนังสือสำเร็จ (ReturnSuccessUI) ----------
function returnTemplate(n: NotificationPayload): any {
  const fineText =
    n.fine_amount && n.fine_amount > 0
      ? ` (มีค่าปรับ ${n.fine_amount} บาท)`
      : "";

  return {
    type: "flex",
    altText: `✅ คืนหนังสือสำเร็จ`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: COLORS.success,
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "✅ คืนหนังสือ",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            align: "center",
          },
          {
            type: "text",
            text: "สำเร็จ!",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            align: "center",
            margin: "xs",
          },
          {
            type: "text",
            text: "ขอบคุณที่ส่งคืนตรงตามเวลา",
            color: "#FFFFFFCC",
            size: "xs",
            align: "center",
            margin: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          dataItem("👤", "ชื่อสมาชิก", n.member_name ?? "-"),
          dataItem("📖", "ชื่อหนังสือ", n.book_title ?? "-"),
          dataItem("🔖", "เล่มที่", String(n.book_copy_no ?? "-")),
          dataItem("📅", "วันที่ยืม", n.borrow_date ?? "-"),
          dataItem(
            "✅",
            "วันที่คืน",
            `${n.return_date ?? "-"}${fineText}`,
            COLORS.success,
            true,
          ),
        ],
      },
      footer: footerBlock(n.action_url),
    },
  };
}

// ---------- Template: ใกล้ครบกำหนดคืน (ReturnReminderUI) ----------
function reminderTemplate(n: NotificationPayload): any {
  const days = n.days_remaining ?? 0;
  const isOverdue = days < 0;

  return {
    type: "flex",
    altText: `⏰ ใกล้ครบกำหนดคืนหนังสือ`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: isOverdue ? COLORS.warning : "#f8b400",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: isOverdue ? "⚠️ เกินกำหนดคืน" : "🔔 ใกล้ครบกำหนด",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            align: "center",
          },
          {
            type: "text",
            text: "คืนหนังสือ",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            align: "center",
            margin: "xs",
          },
          {
            type: "text",
            text: isOverdue
              ? `เกินกำหนด ${Math.abs(days)} วัน อาจมีค่าปรับ`
              : `เหลือเวลาอีก ${days} วัน`,
            color: "#FFFFFFCC",
            size: "sm",
            align: "center",
            margin: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          dataItem("👤", "ชื่อผู้ยืม", n.member_name ?? "-"),
          dataItem("📖", "ชื่อหนังสือ", n.book_title ?? "-"),
          dataItem("🔖", "เล่มที่", String(n.book_copy_no ?? "-")),
          dataItem("📅", "วันที่ยืม", n.borrow_date ?? "-"),
          dataItem(
            "📆",
            "กำหนดคืน",
            n.due_date ?? "-",
            COLORS.warning,
            true,
          ),
        ],
      },
      footer: footerBlock(n.action_url),
    },
  };
}

// ---------- Template: ต่ออายุการยืมสำเร็จ (RenewSuccessUI) ----------
function renewTemplate(n: NotificationPayload): any {
  const usedCount = (n.extension_count ?? 0) + 1;
  const limit = n.extension_limit ?? 1;

  return {
    type: "flex",
    altText: `🔄 ต่ออายุการยืมสำเร็จ`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: COLORS.renew,
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "🔄 ต่ออายุการยืม",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            align: "center",
          },
          {
            type: "text",
            text: "สำเร็จ!",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            align: "center",
            margin: "xs",
          },
          {
            type: "text",
            text: `เพิ่มเวลาอีก ${n.days_extended ?? 7} วัน`,
            color: "#FFFFFFCC",
            size: "sm",
            align: "center",
            margin: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          dataItem("👤", "ชื่อสมาชิก", n.member_name ?? "-"),
          dataItem("📖", "ชื่อหนังสือ", n.book_title ?? "-"),
          dataItem("🔖", "เล่มที่", String(n.book_copy_no ?? "-")),
          dataItem(
            "❌",
            "กำหนดเดิม",
            n.old_due_date ?? "-",
            COLORS.textLight,
          ),
          dataItem(
            "✨",
            "กำหนดใหม่",
            n.new_due_date ?? "-",
            COLORS.renew,
            true,
          ),
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: `ℹ️ ใช้สิทธิ์ต่ออายุ ${usedCount}/${limit} ครั้ง`,
                size: "xs",
                color: COLORS.textLight,
                align: "center",
              },
            ],
            margin: "lg",
            paddingAll: "8px",
            backgroundColor: COLORS.renewBg,
            cornerRadius: "md",
          },
        ],
      },
      footer: footerBlock(n.action_url),
    },
  };
}

/** สร้าง Flex Message ตาม template type */
function buildFlexMessage(n: NotificationPayload) {
  switch (n.template) {
    case "borrow":
      return borrowTemplate(n);
    case "return":
      return returnTemplate(n);
    case "reminder":
      return reminderTemplate(n);
    case "renew":
      return renewTemplate(n);
    default:
      // fallback แบบเดิม
      return legacyFlexMessage(n);
  }
}

/** Legacy Flex Message (สำหรับกรณีไม่ระบุ template) */
function legacyFlexMessage(n: NotificationPayload) {
  const emoji = iconToEmoji(n.icon ?? "bell");

  return {
    type: "flex",
    altText: `${emoji} ${n.title}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: COLORS.secondary,
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
            color: COLORS.textDark,
            wrap: true,
          },
        ],
      },
      ...(n.action_url
        ? {
            footer: footerBlock(n.action_url),
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

// ==========================================================
// Queue helpers
// ==========================================================

/**
 * sendRawFlexMessageToUser — ส่ง Flex Message JSON ตรงไปยัง LINE userId
 * ไม่ผ่าน queue ใช้สำหรับทดสอบ preview
 * คืน { ok, error } เพื่อให้เห็น error ละเอียด
 */
export async function sendRawFlexMessageToUser(
  lineUserId: string,
  flexMessage: any,
): Promise<{ ok: boolean; error: string | null }> {
  const token = getAccessToken();
  if (!token) {
    return { ok: false, error: "LINE_CHANNEL_ACCESS_TOKEN not set" };
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
        messages: [flexMessage],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `LINE API ${res.status}: ${errText.slice(0, 500)}`,
      };
    }
    return { ok: true, error: null };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "fetch error" };
  }
}

/**
 * buildBorrowPreviewFlexMessage — สร้าง Flex Message แบบ hero + card
 * สำหรับส่งทดสอบจากหน้า preview (ไม่ใช่ template จริง)
 * อ้างอิง HTML ที่ส่งให้
 */
export function buildBorrowPreviewFlexMessage(data: {
  memberName: string;
  bookTitle: string;
  copyNo: string;
  borrowDate: string;
  dueDate: string;
  actionUrl?: string;
}): any {
  const heroUrl =
    "https://fhdgnerfevvfofdnafcj.supabase.co/storage/v1/object/public/media/Gemini_Generated_Image_4i4o444i4o444i4o.png";

  return {
    type: "flex",
    altText: "📚 ยืมหนังสือสำเร็จ",
    contents: {
      type: "bubble",
      size: "kilo",
      hero: {
        type: "image",
        url: heroUrl,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
        backgroundColor: COLORS.primary,
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "md",
        spacing: "md",
        contents: [
          // Book title card
          {
            type: "box",
            layout: "horizontal",
            backgroundColor: "#eff6ff",
            cornerRadius: "md",
            paddingAll: "md",
            contents: [
              {
                type: "image",
                url: "https://www.bloggang.com/data/vinitsiri/picture/1326027812.jpg",
                size: "sm",
                aspectRatio: "4:5",
                aspectMode: "cover",
                flex: 0,
              },
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                margin: "sm",
                contents: [
                  {
                    type: "text",
                    text: "ชื่อหนังสือ",
                    color: "#3b82f6",
                    size: "xs",
                    weight: "bold",
                  },
                  {
                    type: "text",
                    text: data.bookTitle,
                    color: "#1e293b",
                    size: "sm",
                    weight: "bold",
                    wrap: true,
                    margin: "xs",
                  },
                ],
              },
            ],
          },
          // Grid row 1: ผู้ยืม + เล่มที่
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                backgroundColor: "#FFFFFF",
                cornerRadius: "md",
                paddingAll: "md",
                contents: [
                  {
                    type: "text",
                    text: "👤 ผู้ยืม",
                    color: "#64748b",
                    size: "xs",
                    weight: "bold",
                  },
                  {
                    type: "text",
                    text: data.memberName,
                    color: "#1e293b",
                    size: "sm",
                    weight: "bold",
                    wrap: true,
                    margin: "xs",
                  },
                ],
              },
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                backgroundColor: "#FFFFFF",
                cornerRadius: "md",
                paddingAll: "md",
                contents: [
                  {
                    type: "text",
                    text: "🔖 เล่มที่",
                    color: "#64748b",
                    size: "xs",
                    weight: "bold",
                  },
                  {
                    type: "text",
                    text: data.copyNo,
                    color: "#1e293b",
                    size: "sm",
                    weight: "bold",
                    margin: "xs",
                  },
                ],
              },
            ],
          },
          // Grid row 2: วันที่ยืม + กำหนดคืน
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                backgroundColor: "#FFFFFF",
                cornerRadius: "md",
                paddingAll: "md",
                contents: [
                  {
                    type: "text",
                    text: "📅 วันที่ยืม",
                    color: "#64748b",
                    size: "xs",
                    weight: "bold",
                  },
                  {
                    type: "text",
                    text: data.borrowDate,
                    color: "#1e293b",
                    size: "xs",
                    weight: "bold",
                    wrap: true,
                    margin: "xs",
                  },
                ],
              },
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                backgroundColor: "#fef2f2",
                cornerRadius: "md",
                paddingAll: "md",
                contents: [
                  {
                    type: "text",
                    text: "📆 กำหนดคืน",
                    color: COLORS.warning,
                    size: "xs",
                    weight: "bold",
                  },
                  {
                    type: "text",
                    text: data.dueDate,
                    color: "#b91c1c",
                    size: "xs",
                    weight: "bold",
                    wrap: true,
                    margin: "xs",
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: footerBlock(data.actionUrl),
    },
  };
}

/**
 * enqueueLineNotification — บันทึก Queue สถานะ pending
 * เรียกจาก Server Action หลังบันทึกข้อมูลหลัก (ยืม/คืน) สำเร็จ
 * คืน queue id เพื่อใช้กับ after()
 */
export async function enqueueLineNotification(
  userId: string,
  payload: NotificationPayload,
  notificationId?: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_queue")
    .insert({
      user_id: userId,
      channel: "line",
      payload,
      status: "pending",
      notification_id: notificationId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[line-notify] enqueue error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

/**
 * sendQueuedLineNotification — ส่ง LINE สำหรับ queue รายการเดียว
 * ใช้ใน after() หลัง Server Action สำเร็จ
 * ถ้าส่งไม่สำเร็จ จะไม่ throw — แค่ปล่อยให้ cron retry
 */
export async function sendQueuedLineNotification(
  queueId: string,
): Promise<void> {
  const admin = createAdminClient();

  // ดึง queue + line_user_id
  const { data: row, error } = await admin
    .from("notification_queue")
    .select(
      `id, user_id, payload, attempts, max_attempts,
       users!inner ( line_user_id )`,
    )
    .eq("id", queueId)
    .maybeSingle();

  if (error || !row) {
    console.error("[line-notify] fetch queue error:", error?.message);
    return;
  }

  const lineUserId = (row as any).users?.line_user_id;
  if (!lineUserId) {
    // user ยังไม่ได้เชื่อม LINE → ทำเครื่องหมาย failed (ไม่ retry ต่อ)
    await admin
      .from("notification_queue")
      .update({
        status: "failed",
        last_error: "user has no line_user_id",
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", queueId);
    return;
  }

  const payload = row.payload as NotificationPayload;
  const ok = await pushToUser(lineUserId, [buildFlexMessage(payload)]);

  if (ok) {
    await admin
      .from("notification_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        attempts: (row.attempts ?? 0) + 1,
        last_error: null,
      })
      .eq("id", queueId);
  } else {
    // ส่งไม่สำเร็จ → คง pending พร้อม retry (เว้นแต่เกิน max_attempts)
    const nextAttempts = (row.attempts ?? 0) + 1;
    const isLast = nextAttempts >= (row.max_attempts ?? 5);
    await admin
      .from("notification_queue")
      .update({
        status: isLast ? "failed" : "pending",
        attempts: nextAttempts,
        last_attempt_at: new Date().toISOString(),
        last_error: "LINE push failed",
      })
      .eq("id", queueId);
  }
}

// ==========================================================
// Cron dispatch — ดึง pending ทั้งหมดมาส่งใหม่
// ==========================================================

/**
 * dispatchLineNotifications — ส่ง LINE notification ที่ค้างอยู่ทั้งหมด
 * เรียกจาก: cron (/api/line/dispatch) ทุก 1 นาที
 * คืนจำนวนที่ส่งสำเร็จ/ล้มเหลว
 */
export async function dispatchLineNotifications(): Promise<{
  sent: number;
  failed: number;
}> {
  const admin = createAdminClient();

  // ดึง pending queue + line_user_id (จำกัด 20 รายการต่อรอบ)
  const { data, error } = await admin
    .from("notification_queue")
    .select(
      `id, user_id, payload, attempts, max_attempts,
       users!inner ( line_user_id )`,
    )
    .eq("status", "pending")
    .eq("channel", "line")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[line-notify] dispatch query error:", error.message);
    return { sent: 0, failed: 0 };
  }

  const rows = (data ?? []) as any[];
  if (rows.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const lineUserId = row.users?.line_user_id;
    if (!lineUserId) {
      await admin
        .from("notification_queue")
        .update({
          status: "failed",
          last_error: "user has no line_user_id",
          last_attempt_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed++;
      continue;
    }

    const payload = row.payload as NotificationPayload;
    const ok = await pushToUser(lineUserId, [buildFlexMessage(payload)]);

    if (ok) {
      await admin
        .from("notification_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
          attempts: (row.attempts ?? 0) + 1,
          last_error: null,
        })
        .eq("id", row.id);
      sent++;
    } else {
      const nextAttempts = (row.attempts ?? 0) + 1;
      const isLast = nextAttempts >= (row.max_attempts ?? 5);
      await admin
        .from("notification_queue")
        .update({
          status: isLast ? "failed" : "pending",
          attempts: nextAttempts,
          last_attempt_at: new Date().toISOString(),
          last_error: "LINE push failed",
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return { sent, failed };
}

// ==========================================================
// Reminder: ตรวจหนังสือใกล้ครบกำหนด (เรียกจาก cron)
// ==========================================================

/**
 * checkDueDateReminders — ตรวจ borrow_records ที่ใกล้ครบกำหนด (3 วัน)
 * และ enqueue LINE reminder ให้ผู้ยืม
 * เรียกจาก cron (/api/line/dispatch) หรือ cron แยก
 */
export async function checkDueDateReminders(): Promise<{
  enqueued: number;
}> {
  const admin = createAdminClient();

  // หา borrow_records ที่ status='borrowing' และ due_date ในอีก 3 วัน
  // และยังไม่มี reminder ใน queue (เช็คจาก payload ที่มี template='reminder')
  const now = new Date();
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const { data: borrows, error } = await admin
    .from("borrow_records")
    .select(
      `id, user_id, book_copy_id, borrowed_at, due_date,
       users ( id, full_name, line_user_id ),
       book_copies!inner ( barcode, books ( title ) )`,
    )
    .eq("status", "borrowing")
    .lte("due_date", threeDaysLater.toISOString())
    .gte("due_date", now.toISOString())
    .is("returned_at", null);

  if (error) {
    console.error("[line-notify] reminder query error:", error.message);
    return { enqueued: 0 };
  }

  const rows = (borrows ?? []) as any[];
  let enqueued = 0;

  for (const b of rows) {
    const userId = b.user_id;
    const bookTitle = b.book_copies?.books?.title ?? "หนังสือ";
    const memberName = b.users?.full_name ?? "-";
    const copyNo = b.book_copies?.barcode ?? "-";

    // คำนวณจำนวนวันที่เหลือ
    const dueDate = new Date(b.due_date);
    const diffMs = dueDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // เช็คว่ามี reminder สำหรับ borrow_record นี้ใน queue แล้วหรือยัง
    // (เช็คจาก payload.ref_id หรือสร้างใหม่วันละครั้ง)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: existing } = await admin
      .from("notification_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("channel", "line")
      .eq("status", "pending")
      .gte("created_at", today.toISOString())
      .contains("payload", { template: "reminder", ref_id: b.id })
      .maybeSingle();

    if (existing) continue; // มี reminder วันนี้แล้ว

    const borrowDateStr = new Date(b.borrowed_at).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const dueDateStr = dueDate.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const queueId = await enqueueLineNotification(
      userId,
      {
        template: "reminder",
        title: "ใกล้ครบกำหนดคืนหนังสือ",
        body: `เหลือเวลาอีก ${daysRemaining} วัน`,
        action_url: "/member/loans",
        icon: "bell-ringing",
        category: "loan",
        member_name: memberName,
        book_title: bookTitle,
        book_copy_no: copyNo,
        borrow_date: borrowDateStr,
        due_date: dueDateStr,
        days_remaining: daysRemaining,
        ref_id: b.id,
      },
      undefined,
    );

    if (queueId) {
      // ส่งทันทีผ่าน after() ไม่ได้ (cron context) → ให้ cron dispatch ส่ง
      enqueued++;
    }
  }

  return { enqueued };
}

// ==========================================================
// Reminder: คำขอกลืนคืนค้างเกิน 7 วัน (เรียกจาก cron)
// ==========================================================

/**
 * checkPendingReturnReminders — ตรวจคำขอกลืนคืน (status='pending_return')
 * ที่ค้างเกิน 7 วันแล้ว แจ้งเตือนเจ้าหน้าที่ผ่าน LINE ว่ามีรายการที่ต้องรีบตรวจ
 * เรียกจาก cron (/api/line/dispatch)
 */
export async function checkPendingReturnReminders(): Promise<{
  enqueued: number;
}> {
  const admin = createAdminClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: borrows, error } = await admin
    .from("borrow_records")
    .select(
      `id, user_id, book_copy_id, return_requested_at, return_condition,
       users ( full_name ),
       book_copies ( barcode, books ( title ) )`,
    )
    .eq("status", "pending_return")
    .lte("return_requested_at", sevenDaysAgo.toISOString());

  if (error) {
    console.error("[line-notify] pending return query error:", error.message);
    return { enqueued: 0 };
  }

  const rows = (borrows ?? []) as any[];
  if (rows.length === 0) return { enqueued: 0 };

  // เอาจำนวนที่ค้างเกิน 7 วัน เพื่อส่งข้อความสรุปเดียวให้เจ้าหน้าที่
  const { data: staffUsers } = await admin
    .from("users")
    .select("id")
    .in("role", ["staff", "admin"])
    .not("line_user_id", "is", null);

  let enqueued = 0;

  for (const staff of staffUsers ?? []) {
    const queueId = await enqueueLineNotification(
      staff.id,
      {
        template: "return",
        title: `มีคำขอกลืนคืนค้าง ${rows.length} รายการ`,
        body: `รายการคำขอกลืนคืนค้างเกิน 7 วันแล้ว กรุณาตรวจสอบโดยเร็ว`,
        action_url: "/staff/loans/returns",
        icon: "alarm",
        category: "loan",
        member_name: rows[0]?.users?.full_name ?? "-",
        book_title: rows[0]?.book_copies?.books?.title ?? "หนังสือ",
        book_copy_no: rows[0]?.book_copies?.barcode ?? "-",
        borrow_date: now.toLocaleDateString("th-TH"),
        return_date: now.toLocaleDateString("th-TH"),
        fine_amount: 0,
      },
      undefined,
    );

    if (queueId) {
      enqueued++;
    }
  }

  return { enqueued };
}

// ==========================================================
// Legacy helpers (ใช้สำหรับกรณี inline ที่ไม่ผ่าน queue)
// ==========================================================

/**
 * sendLineMessage — ส่งข้อความไปยัง LINE userId คนหนึ่งทันที (inline)
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