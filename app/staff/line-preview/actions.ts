"use server";

import { createClient } from "@/utils/supabase/server";
import {
  enqueueLineNotification,
  sendQueuedLineNotification,
  sendRawFlexMessageToUser,
  buildBorrowPreviewFlexMessage,
} from "@/utils/line-notify";

/**
 * Server Actions สำหรับ /staff/line-preview
 * ส่ง Flex Message ทดสอบไปยัง LINE ของ user ที่เลือก
 * พร้อม debug info กลับมาให้ดู error ได้
 */

// ---------- 0. getLineUsersAction ----------
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

// ---------- 1. sendTestAction ----------
/**
 * sendTestAction — ส่งแจ้งเตือนไปยัง LINE ของ user ที่เลือก
 * ใช้สำหรับทดสอบว่า Flex Message ส่งได้หรือไม่
 * คืน debug info กลับมาให้แสดงในหน้า
 */
export async function sendTestAction(
  formData: FormData,
): Promise<{
  error: string | null;
  debug: {
    step: string;
    status: "ok" | "error";
    message: string;
  }[];
  queueId: string | null;
}> {
  const debug: { step: string; status: "ok" | "error"; message: string }[] = [];

  // Step 1: เช็ค login (admin/staff เท่านั้น)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    debug.push({ step: "1. เช็ค login", status: "error", message: "ไม่ได้ login" });
    return { error: "กรุณาเข้าสู่ระบบ", debug, queueId: null };
  }
  debug.push({ step: "1. เช็ค login", status: "ok", message: `user: ${user.id}` });

  // Step 2: ดึง target user
  const targetUserId = String(formData.get("target_user_id") ?? "").trim();
  if (!targetUserId) {
    debug.push({
      step: "2. เลือก user",
      status: "error",
      message: "ไม่ได้เลือก user ปลายทาง",
    });
    return { error: "กรุณาเลือก user ที่จะส่งแจ้งเตือน", debug, queueId: null };
  }

  const { data: target, error: targetErr } = await supabase
    .from("users")
    .select("line_user_id, full_name")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetErr) {
    debug.push({
      step: "2. ดึง target user",
      status: "error",
      message: targetErr.message,
    });
    return { error: targetErr.message, debug, queueId: null };
  }

  if (!target?.line_user_id) {
    debug.push({
      step: "2. เช็ค LINE",
      status: "error",
      message: "user นี้ยังไม่ได้เชื่อมต่อ LINE",
    });
    return {
      error: "user ที่เลือกยังไม่ได้เชื่อมต่อ LINE",
      debug,
      queueId: null,
    };
  }
  debug.push({
    step: "2. เช็ค LINE",
    status: "ok",
    message: `${target.full_name} (${target.line_user_id})`,
  });

  // Step 3: สร้าง payload ตาม template
  const template = String(formData.get("template") ?? "borrow");
  const memberName = target.full_name ?? "ทดสอบ";
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
        title: "ยืมหนังสือสำเร็จ (ทดสอบ)",
        body: "ทดสอบการส่งแจ้งเตือน",
        action_url: "/member/loans",
        icon: "book-open",
        category: "loan",
        member_name: memberName,
        book_title: "หลักการออกแบบ UX/UI Design",
        book_copy_no: "TEST-001",
        borrow_date: dateStr,
        due_date: dateStr,
      };
      break;
    case "return":
      payload = {
        template: "return",
        title: "คืนหนังสือสำเร็จ (ทดสอบ)",
        body: "ทดสอบการส่งแจ้งเตือน",
        action_url: "/member/loans",
        icon: "book",
        category: "loan",
        member_name: memberName,
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
        title: "ใกล้ครบกำหนดคืนหนังสือ (ทดสอบ)",
        body: "ทดสอบการส่งแจ้งเตือน",
        action_url: "/member/loans",
        icon: "bell-ringing",
        category: "loan",
        member_name: memberName,
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
        title: "ต่ออายุการยืมสำเร็จ (ทดสอบ)",
        body: "ทดสอบการส่งแจ้งเตือน",
        action_url: "/member/loans",
        icon: "clock",
        category: "loan",
        member_name: memberName,
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
        title: "ทดสอบแจ้งเตือน",
        body: "ทดสอบการส่งแจ้งเตือน LINE",
        action_url: "/member/loans",
        icon: "bell",
        category: "loan",
      };
  }

  debug.push({
    step: "3. สร้าง payload",
    status: "ok",
    message: `template: ${template}, keys: ${Object.keys(payload).join(", ")}`,
  });

  // Step 4: Enqueue
  const queueId = await enqueueLineNotification(targetUserId, payload);

  if (!queueId) {
    debug.push({
      step: "4. enqueue",
      status: "error",
      message: "enqueueLineNotification คืน null — อาจเป็นเพราะ table ไม่มีหรือ RLS",
    });
    return {
      error: "ไม่สามารถเพิ่มเข้า queue ได้",
      debug,
      queueId: null,
    };
  }
  debug.push({ step: "4. enqueue", status: "ok", message: `queueId: ${queueId}` });

  // Step 5: ส่งทันที (ไม่ใช้ after เพื่อเห็น error ได้)
  try {
    await sendQueuedLineNotification(queueId);
    debug.push({
      step: "5. ส่ง LINE",
      status: "ok",
      message: "ส่งสำเร็จ — ตรวจสอบ LINE ของ user ที่เลือก",
    });
  } catch (err: any) {
    debug.push({
      step: "5. ส่ง LINE",
      status: "error",
      message: `error: ${err?.message ?? "unknown"}\nstack: ${err?.stack ?? ""}`,
    });
    return { error: err?.message ?? "ส่งไม่สำเร็จ", debug, queueId };
  }

  // Step 6: ตรวจสอบสถานะใน queue
  const { data: queueRow } = await supabase
    .from("notification_queue")
    .select("status, attempts, last_error")
    .eq("id", queueId)
    .maybeSingle();

  if (queueRow) {
    debug.push({
      step: "6. ตรวจสอบสถานะ",
      status: queueRow.status === "sent" ? "ok" : "error",
      message: `status: ${queueRow.status}, attempts: ${queueRow.attempts}, last_error: ${queueRow.last_error ?? "none"}`,
    });
  }

  return { error: null, debug, queueId };
}

// ---------- 2. sendPreviewTestAction ----------
/**
 * sendPreviewTestAction — ส่ง Flex Message แบบ preview (hero + card)
 * ตรงไปยัง LINE API ไม่ผ่าน queue
 * ใช้สำหรับทดสอบว่า layout แบบใหม่ส่งได้หรือไม่
 */
export async function sendPreviewTestAction(
  formData: FormData,
): Promise<{
  error: string | null;
  debug: {
    step: string;
    status: "ok" | "error";
    message: string;
  }[];
}> {
  const debug: { step: string; status: "ok" | "error"; message: string }[] = [];

  // Step 1: เช็ค login
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    debug.push({ step: "1. เช็ค login", status: "error", message: "ไม่ได้ login" });
    return { error: "กรุณาเข้าสู่ระบบ", debug };
  }
  debug.push({ step: "1. เช็ค login", status: "ok", message: `user: ${user.id}` });

  // Step 2: ดึง target user
  const targetUserId = String(formData.get("target_user_id") ?? "").trim();
  if (!targetUserId) {
    debug.push({
      step: "2. เลือก user",
      status: "error",
      message: "ไม่ได้เลือก user ปลายทาง",
    });
    return { error: "กรุณาเลือก user ที่จะส่งแจ้งเตือน", debug };
  }

  const { data: target, error: targetErr } = await supabase
    .from("users")
    .select("line_user_id, full_name")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetErr) {
    debug.push({
      step: "2. ดึง target user",
      status: "error",
      message: targetErr.message,
    });
    return { error: targetErr.message, debug };
  }

  if (!target?.line_user_id) {
    debug.push({
      step: "2. เช็ค LINE",
      status: "error",
      message: "user นี้ยังไม่ได้เชื่อมต่อ LINE",
    });
    return { error: "user ที่เลือกยังไม่ได้เชื่อมต่อ LINE", debug };
  }
  debug.push({
    step: "2. เช็ค LINE",
    status: "ok",
    message: `${target.full_name} (${target.line_user_id})`,
  });

  // Step 3: สร้าง Flex Message แบบ preview
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const flexMessage = buildBorrowPreviewFlexMessage({
    memberName: target.full_name ?? "ทดสอบ",
    bookTitle: "หลักการออกแบบ UX/UI Design",
    copyNo: "TEST-001",
    borrowDate: dateStr,
    dueDate: dateStr,
    actionUrl: "/member/loans",
  });

  debug.push({
    step: "3. สร้าง preview Flex Message",
    status: "ok",
    message: `hero + header + body + footer (แบบ preview)`,
  });

  // Step 4: ส่งตรงไป LINE (ไม่ผ่าน queue)
  const result = await sendRawFlexMessageToUser(
    target.line_user_id,
    flexMessage,
  );

  if (!result.ok) {
    debug.push({
      step: "4. ส่ง LINE (preview)",
      status: "error",
      message: result.error ?? "unknown error",
    });
    return { error: result.error, debug };
  }

  debug.push({
    step: "4. ส่ง LINE (preview)",
    status: "ok",
    message: "ส่งสำเร็จ — ตรวจสอบ LINE ของ user ที่เลือก",
  });

  return { error: null, debug };
}