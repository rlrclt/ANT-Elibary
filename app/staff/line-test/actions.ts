"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { after } from "next/server";
import {
  enqueueLineNotification,
  sendQueuedLineNotification,
  dispatchLineNotifications,
} from "@/utils/line-notify";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /staff/line-test
 * หน้าทดสอบการส่งแจ้งเตือน LINE สำหรับแอดมิน/เจ้าหน้าที่
 */

// ---------- 1. getLineUsersAction ----------
/** ดึงรายการ users ที่เชื่อม LINE แล้ว */
export async function getLineUsersAction(): Promise<{
  data: {
    id: string;
    full_name: string;
    user_id_code: string;
    line_user_id: string | null;
  }[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, user_id_code, line_user_id")
    .not("line_user_id", "is", null)
    .order("full_name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

// ---------- 2. sendTestNotificationAction ----------
/** ส่งแจ้งเตือน LINE ทดสอบไปยัง user คนหนึ่ง */
export async function sendTestNotificationAction(
  formData: FormData,
): Promise<{ error: string | null; queueId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", queueId: null };

  const userId = String(formData.get("user_id") ?? "").trim();
  const template = String(formData.get("template") ?? "borrow").trim();
  const customTitle = String(formData.get("title") ?? "").trim();
  const customBody = String(formData.get("body") ?? "").trim();

  if (!userId) return { error: "กรุณาเลือกสมาชิก", queueId: null };

  // ดึงข้อมูล user
  const { data: member } = await supabase
    .from("users")
    .select("id, full_name, line_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (!member) return { error: "ไม่พบสมาชิก", queueId: null };
  if (!member.line_user_id) {
    return { error: "สมาชิกยังไม่ได้เชื่อมต่อ LINE", queueId: null };
  }

  // สร้าง payload ตาม template ที่เลือก
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let payload: any;

  switch (template) {
    case "borrow":
      payload = {
        template: "borrow",
        title: customTitle || "ยืมหนังสือสำเร็จ (ทดสอบ)",
        body: customBody || "ทดสอบการส่งแจ้งเตือน",
        action_url: "/member/loans",
        icon: "book-open",
        category: "loan",
        member_name: member.full_name,
        book_title: "หลักการออกแบบ UX/UI Design",
        book_copy_no: "TEST-001",
        borrow_date: dateStr,
        due_date: dateStr,
      };
      break;

    case "return":
      payload = {
        template: "return",
        title: customTitle || "คืนหนังสือสำเร็จ (ทดสอบ)",
        body: customBody || "ทดสอบการส่งแจ้งเตือน",
        action_url: "/member/loans",
        icon: "book",
        category: "loan",
        member_name: member.full_name,
        book_title: "หลักการออกแบบ UX/UI Design",
        book_copy_no: "TEST-001",
        borrow_date: dateStr,
        return_date: dateStr,
        fine_amount: 0,
      };
      break;

    case "reminder":
      payload = {
        template: "reminder",
        title: customTitle || "ใกล้ครบกำหนดคืนหนังสือ (ทดสอบ)",
        body: customBody || "ทดสอบการส่งแจ้งเตือน",
        action_url: "/member/loans",
        icon: "bell-ringing",
        category: "loan",
        member_name: member.full_name,
        book_title: "หลักการออกแบบ UX/UI Design",
        book_copy_no: "TEST-001",
        borrow_date: dateStr,
        due_date: dateStr,
        days_remaining: 3,
      };
      break;

    case "renew":
      payload = {
        template: "renew",
        title: customTitle || "ต่ออายุการยืมสำเร็จ (ทดสอบ)",
        body: customBody || "ทดสอบการส่งแจ้งเตือน",
        action_url: "/member/loans",
        icon: "clock",
        category: "loan",
        member_name: member.full_name,
        book_title: "หลักการออกแบบ UX/UI Design",
        book_copy_no: "TEST-001",
        old_due_date: dateStr,
        new_due_date: dateStr,
        days_extended: 7,
        extension_count: 0,
        extension_limit: 1,
      };
      break;

    default:
      payload = {
        title: customTitle || "ทดสอบแจ้งเตือน",
        body: customBody || "ทดสอบการส่งแจ้งเตือน LINE",
        action_url: "/member/loans",
        icon: "bell",
        category: "loan",
      };
  }

  // enqueue + after() ส่งทันที
  const queueId = await enqueueLineNotification(userId, payload);

  if (queueId) {
    after(() => sendQueuedLineNotification(queueId));
  }

  revalidatePath("/staff/line-test");
  return { error: null, queueId };
}

// ---------- 3. sendBroadcastAction ----------
/** ส่งแจ้งเตือน LINE ไปยังทุกคนที่เชื่อม LINE แล้ว */
export async function sendBroadcastAction(
  formData: FormData,
): Promise<{ error: string | null; sent: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ", sent: 0 };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) {
    return { error: "กรุณากรอกหัวข้อและข้อความ", sent: 0 };
  }

  // ดึง users ที่เชื่อม LINE แล้ว
  const { data: users, error } = await supabase
    .from("users")
    .select("id")
    .not("line_user_id", "is", null);

  if (error) return { error: error.message, sent: 0 };

  const userList = users ?? [];
  let count = 0;

  for (const u of userList) {
    const queueId = await enqueueLineNotification(u.id, {
      title,
      body,
      action_url: "/member/loans",
      icon: "bell",
      category: "loan",
    });

    if (queueId) {
      after(() => sendQueuedLineNotification(queueId));
      count++;
    }
  }

  revalidatePath("/staff/line-test");
  return { error: null, sent: count };
}

// ---------- 4. getQueueStatsAction ----------
/** ดึงสถิติ notification_queue */
export async function getQueueStatsAction(): Promise<{
  data: {
    pending: number;
    sent: number;
    failed: number;
    total: number;
  };
  error: string | null;
}> {
  const admin = createAdminClient();

  const [
    { count: pending },
    { count: sent },
    { count: failed },
    { count: total },
  ] = await Promise.all([
    admin
      .from("notification_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("notification_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent"),
    admin
      .from("notification_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed"),
    admin
      .from("notification_queue")
      .select("*", { count: "exact", head: true }),
  ]);

  return {
    data: {
      pending: pending ?? 0,
      sent: sent ?? 0,
      failed: failed ?? 0,
      total: total ?? 0,
    },
    error: null,
  };
}

// ---------- 5. getQueueListAction ----------
/** ดึงรายการล่าสุดใน notification_queue */
export async function getQueueListAction(): Promise<{
  data: {
    id: string;
    user_id: string;
    status: string;
    attempts: number;
    last_error: string | null;
    created_at: string;
    payload: any;
  }[];
  error: string | null;
}> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("notification_queue")
    .select("id, user_id, status, attempts, last_error, created_at, payload")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

// ---------- 6. triggerDispatchAction ----------
/** กระตุ้น dispatch ส่ง pending ทั้งหมด (เรียกจากปุ่ม) */
export async function triggerDispatchAction(): Promise<{
  error: string | null;
  sent: number;
  failed: number;
}> {
  try {
    const result = await dispatchLineNotifications();
    revalidatePath("/staff/line-test");
    return { error: null, sent: result.sent, failed: result.failed };
  } catch (err: any) {
    return { error: err?.message ?? "Unknown error", sent: 0, failed: 0 };
  }
}