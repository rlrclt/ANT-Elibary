"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server Actions สำหรับ /staff/announcements
 * จัดการประกาศ/ข่าวสาร/แจ้งเตือนระบบ ในตาราง public.announcements
 * ใช้ server client (RLS อนุญาต staff/admin จัดการได้ทั้งหมด)
 */

// ---------- Types ----------
export type Announcement = {
  id: string;
  title: string;
  body: string;
  type: "notice" | "news" | "alert";
  target_audience: "all" | "member" | "staff";
  action_label: string | null;
  action_url: string | null;
  image_url: string | null;
  is_pinned: boolean;
  is_active: boolean;
  show_on_homepage: boolean;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
};

type AnnouncementFilters = {
  type?: string;
  target?: string;
  search?: string;
};

// ---------- 1. getAnnouncementsAction ----------
export async function getAnnouncementsAction(
  filters?: AnnouncementFilters,
): Promise<{ data: Announcement[] | null; error: string | null }> {
  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select(
      "id, title, body, type, target_audience, action_label, action_url, image_url, is_pinned, is_active, show_on_homepage, start_at, end_at, created_at",
    )
    // เรียงปักหมุดก่อน แล้วตามด้วยวันที่ใหม่ล่าสุด
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters?.type && filters.type !== "all") {
    query = query.eq("type", filters.type);
  }
  if (filters?.target && filters.target !== "all") {
    query = query.eq("target_audience", filters.target);
  }
  if (filters?.search) {
    const s = filters.search.trim();
    query = query.or(`title.ilike.%${s}%,body.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: data as Announcement[], error: null };
}

// ---------- 2. createAnnouncementAction ----------
export async function createAnnouncementAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // ดึง user ปัจจุบันเพื่อเก็บ created_by
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "กรุณากรอกหัวข้อประกาศ" };
  if (!body) return { error: "กรุณากรอกรายละเอียดประกาศ" };

  const type = String(formData.get("type") ?? "notice") as
    | "notice"
    | "news"
    | "alert";
  const target_audience = String(formData.get("target_audience") ?? "all") as
    | "all"
    | "member"
    | "staff";
  const action_label =
    String(formData.get("action_label") ?? "").trim() || null;
  const action_url = String(formData.get("action_url") ?? "").trim() || null;
  const image_url = String(formData.get("image_url") ?? "").trim() || null;
  const is_pinned = formData.get("is_pinned") === "on";
  const show_on_homepage = formData.get("show_on_homepage") === "on";
  const start_at =
    String(formData.get("start_at") ?? "").trim() || null;
  const end_at = String(formData.get("end_at") ?? "").trim() || null;

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    type,
    target_audience,
    action_label,
    action_url,
    image_url,
    is_pinned,
    is_active: true,
    show_on_homepage,
    start_at,
    end_at,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/staff/announcements");
  return { error: null };
}

// ---------- 3. updateAnnouncementAction ----------
export async function updateAnnouncementAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID ประกาศ" };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "กรุณากรอกหัวข้อประกาศ" };
  if (!body) return { error: "กรุณากรอกรายละเอียดประกาศ" };

  const type = String(formData.get("type") ?? "notice") as
    | "notice"
    | "news"
    | "alert";
  const target_audience = String(formData.get("target_audience") ?? "all") as
    | "all"
    | "member"
    | "staff";
  const action_label =
    String(formData.get("action_label") ?? "").trim() || null;
  const action_url = String(formData.get("action_url") ?? "").trim() || null;
  const image_url = String(formData.get("image_url") ?? "").trim() || null;
  const is_pinned = formData.get("is_pinned") === "on";
  const show_on_homepage = formData.get("show_on_homepage") === "on";
  const start_at =
    String(formData.get("start_at") ?? "").trim() || null;
  const end_at = String(formData.get("end_at") ?? "").trim() || null;

  const { error } = await supabase
    .from("announcements")
    .update({
      title,
      body,
      type,
      target_audience,
      action_label,
      action_url,
      image_url,
      is_pinned,
      show_on_homepage,
      start_at,
      end_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/announcements");
  return { error: null };
}

// ---------- 4. deleteAnnouncementAction ----------
export async function deleteAnnouncementAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID ประกาศ" };

  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/staff/announcements");
  return { error: null };
}

// ---------- 5. togglePinAction ----------
export async function togglePinAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID ประกาศ" };

  const is_pinned = formData.get("is_pinned") === "true";

  const { error } = await supabase
    .from("announcements")
    .update({ is_pinned: !is_pinned, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/announcements");
  return { error: null };
}

// ---------- 6. toggleActiveAction ----------
export async function toggleActiveAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "ไม่พบ ID ประกาศ" };

  const is_active = formData.get("is_active") === "true";

  const { error } = await supabase
    .from("announcements")
    .update({ is_active: !is_active, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/staff/announcements");
  return { error: null };
}