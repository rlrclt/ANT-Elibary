"use server";

import { createClient } from "@/utils/supabase/server";

/**
 * Server Actions สำหรับ NotificationBell (ฝั่ง member/staff header)
 * ดึงข้อมูล 2 แหล่ง:
 *   1. announcements — ประกาศ/ข่าวสาร/แจ้งเตือนระบบ ที่แอดมินสร้าง (static, schedule)
 *   2. system_notifications — แจ้งเตือนอัตโนมัติจาก DB trigger (ยืม/คืน/access/account)
 *      + virtual notifications คำนวณตอนโหลด (ใกล้ครบกำหนด / เกินกำหนด)
 *
 * Tab "แจ้งเตือนระบบ": รวม announcements[type=alert] + system_notifications + virtual
 * Tab "ฟีดข่าวสาร": announcements[type=notice|news]
 */

// ---------- Types ----------
export type BellAnnouncement = {
  id: string;
  title: string;
  body: string;
  type: "notice" | "news" | "alert";
  target_audience: "all" | "member" | "staff";
  action_label: string | null;
  action_url: string | null;
  image_url: string | null;
  is_pinned: boolean;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  read: boolean;
};

export type SystemNotification = {
  id: string;
  category: "loan" | "access" | "account";
  event_type: string;
  title: string;
  body: string;
  ref_id: string | null;
  action_url: string | null;
  icon: string;
  is_read: boolean;
  created_at: string;
};

/** notification ที่คำนวณแบบ real-time (ไม่เก็บใน DB) */
export type VirtualNotification = {
  id: string; // ใช้ prefix "virtual-" + loan_id
  category: "loan";
  event_type: "due_soon" | "overdue";
  title: string;
  body: string;
  ref_id: string | null;
  action_url: string;
  icon: string;
  is_read: boolean; // overdue = unread เสมอ, due_soon = อ่านแล้ว
  created_at: string; // ใช้ now()
};

// ---------- 1. getMyAnnouncementsAction ----------
export async function getMyAnnouncementsAction(): Promise<{
  data: {
    alerts: BellAnnouncement[];
    news: BellAnnouncement[];
    systemAlerts: (SystemNotification | VirtualNotification)[];
  } | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { data: { alerts: [], news: [], systemAlerts: [] }, error: null };

  // ---- ดึง announcements (ประกาศแอดมิน) ----
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "member";
  const targets = role === "member" ? ["member", "all"] : ["staff", "all"];

  let alerts: BellAnnouncement[] = [];
  let news: BellAnnouncement[] = [];

  try {
    const { data: anns } = await supabase
      .from("announcements")
      .select(
        "id, title, body, type, target_audience, action_label, action_url, image_url, is_pinned, start_at, end_at, created_at",
      )
      .eq("is_active", true)
      .in("target_audience", targets)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (anns && anns.length > 0) {
      // ดึงรายการที่ user อ่านแล้ว
      const { data: reads } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", user.id);

      const readSet = new Set((reads ?? []).map((r) => r.announcement_id));

      const mapped: BellAnnouncement[] = anns.map((a: any) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        type: a.type,
        target_audience: a.target_audience,
        action_label: a.action_label,
        action_url: a.action_url,
        image_url: a.image_url,
        is_pinned: a.is_pinned,
        start_at: a.start_at,
        end_at: a.end_at,
        created_at: a.created_at,
        read: readSet.has(a.id),
      }));

      alerts = mapped.filter((a) => a.type === "alert");
      news = mapped.filter((a) => a.type === "notice" || a.type === "news");
    }
  } catch {
    // table ยังไม่ถูกสร้าง → ข้าม
  }

  // ---- ดึง system_notifications (แจ้งเตือนอัตโนมัติจาก trigger) ----
  let systemNotifs: SystemNotification[] = [];
  try {
    const { data: sysNotifs } = await supabase
      .from("system_notifications")
      .select(
        "id, category, event_type, title, body, ref_id, action_url, icon, is_read, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (sysNotifs) {
      systemNotifs = sysNotifs.map((n: any) => ({
        id: n.id,
        category: n.category,
        event_type: n.event_type,
        title: n.title,
        body: n.body,
        ref_id: n.ref_id,
        action_url: n.action_url,
        icon: n.icon,
        is_read: n.is_read,
        created_at: n.created_at,
      }));
    }
  } catch {
    // table ยังไม่ถูกสร้าง → ข้าม
  }

  // ---- คำนวณ virtual notifications (ใกล้ครบกำหนด / เกินกำหนด) ----
  const virtualNotifs: VirtualNotification[] = [];
  try {
    const { data: activeLoans } = await supabase
      .from("borrow_records")
      .select(
        `id, due_date, status, book_copy_id:book_copy_id (book_id:book_id (title))`,
      )
      .eq("user_id", user.id)
      .in("status", ["borrowing", "overdue"])
      .order("due_date", { ascending: true });

    if (activeLoans) {
      const now = Date.now();
      const nowIso = new Date().toISOString();
      for (const loan of activeLoans as any[]) {
        const dueMs = new Date(loan.due_date).getTime();
        const diffH = (dueMs - now) / 3600000;
        const bookTitle = loan.book_copy_id?.book_id?.title ?? "หนังสือ";

        if (diffH < 0) {
          // เกินกำหนด
          const overdueDays = Math.floor(Math.abs(diffH) / 24);
          virtualNotifs.push({
            id: `virtual-overdue-${loan.id}`,
            category: "loan",
            event_type: "overdue",
            title: "เกินกำหนดคืนหนังสือ",
            body: `"${bookTitle}" เกินกำหนด ${overdueDays} วันแล้ว`,
            ref_id: loan.id,
            action_url: "/member/loans",
            icon: "warning-circle",
            is_read: false, // overdue เสมือน unread
            created_at: nowIso,
          });
        } else if (diffH <= 72) {
          // ใกล้ครบกำหนด (ภายใน 3 วัน)
          const dueDate = new Date(loan.due_date);
          const pad = (n: number) => String(n).padStart(2, "0");
          const dueStr = `${pad(dueDate.getDate())}/${pad(
            dueDate.getMonth() + 1,
          )}/${dueDate.getFullYear() + 543} ${pad(dueDate.getHours())}:${pad(
            dueDate.getMinutes(),
          )}`;
          virtualNotifs.push({
            id: `virtual-duesoon-${loan.id}`,
            category: "loan",
            event_type: "due_soon",
            title: "ใกล้ครบกำหนดคืน",
            body: `"${bookTitle}" ครบกำหนด ${dueStr}`,
            ref_id: loan.id,
            action_url: "/member/loans",
            icon: "clock",
            is_read: true, // due_soon เสมือนอ่านแล้ว (ไม่นับ unread)
            created_at: nowIso,
          });
        }
      }
    }
  } catch {
    // borrow_records query ล้มเหลว → ข้าม
  }

  // รวม system + virtual, เรียง overdue ก่อน แล้วตาม created_at
  const systemAlerts: (SystemNotification | VirtualNotification)[] = [
    ...virtualNotifs.filter((v) => v.event_type === "overdue"),
    ...systemNotifs,
    ...virtualNotifs.filter((v) => v.event_type === "due_soon"),
  ];

  return { data: { alerts, news, systemAlerts }, error: null };
}

// ---------- 2. markAsReadAction ----------
// รองรับทั้ง announcement และ system_notification
export async function markAsReadAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "announcement"); // "announcement" | "system"
  if (!id) return { error: "ไม่พบ ID" };

  if (kind === "system") {
    // อัปเดต is_read = true ใน system_notifications
    const { error } = await supabase
      .from("system_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id); // RLS จะกรองอยู่แล้ว แต่ใส่เพื่อความปลอดภัย
    if (error) return { error: error.message };
    return { error: null };
  }

  // announcement: INSERT (ignore ถ้าซ้ำ — UNIQUE constraint)
  const { error } = await supabase
    .from("announcement_reads")
    .insert({ announcement_id: id, user_id: user.id });

  if (error && error.code !== "23505") return { error: error.message };
  return { error: null };
}

// ---------- 3. getUnreadCountAction ----------
// รวม: announcements ที่ยังไม่อ่าน + system_notifications ที่ยังไม่อ่าน + virtual overdue
export async function getUnreadCountAction(): Promise<{
  data: number;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: 0, error: null };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "member";
  const targets = role === "member" ? ["member", "all"] : ["staff", "all"];

  let count = 0;

  // ---- announcements ที่ยังไม่อ่าน ----
  try {
    const { data: anns } = await supabase
      .from("announcements")
      .select("id")
      .eq("is_active", true)
      .in("target_audience", targets);

    if (anns && anns.length > 0) {
      const annIds = anns.map((a) => a.id);
      const { data: reads } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", user.id)
        .in("announcement_id", annIds);

      const readCount = new Set((reads ?? []).map((r) => r.announcement_id)).size;
      count += annIds.length - readCount;
    }
  } catch {
    // ข้าม
  }

  // ---- system_notifications ที่ยังไม่อ่าน ----
  try {
    const { count: sysUnread } = await supabase
      .from("system_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (sysUnread) count += sysUnread;
  } catch {
    // table ยังไม่ถูกสร้าง → ข้าม
  }

  // ---- virtual overdue (เสมือน unread เสมอ) ----
  try {
    const { data: overdueLoans } = await supabase
      .from("borrow_records")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "overdue");

    if (overdueLoans) count += overdueLoans.length;
  } catch {
    // ข้าม
  }

  return { data: count, error: null };
}