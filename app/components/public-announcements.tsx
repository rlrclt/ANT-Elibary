import { createClient } from "@/utils/supabase/server";
import { AnnouncementPopup } from "./announcement-popup";

type HomeAnnouncement = {
  id: string;
  title: string;
  body: string;
  type: string;
  action_label: string | null;
  action_url: string | null;
  image_url: string | null;
  is_pinned: boolean;
  start_at: string | null;
  end_at: string | null;
};

/**
 * PublicAnnouncements — แสดงประกาศบนหน้าแรกเป็น popup
 * ดึงประกาศที่: is_active + show_on_homepage + target='all'
 *  + ยังไม่หมดอายุ (end_at IS NULL OR end_at > now)
 *  + เริ่มแสดงแล้ว (start_at IS NULL OR start_at <= now)
 * เรียงลำดับ: pinned ก่อน แล้ว created_at ใหม่ล่าสุด จำกัด 5 รายการ
 */
export async function PublicAnnouncements() {
  const supabase = await createClient();

  let announcements: HomeAnnouncement[] = [];
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("announcements")
      .select(
        "id, title, body, type, action_label, action_url, image_url, is_pinned, start_at, end_at",
      )
      .eq("is_active", true)
      .eq("target_audience", "all")
      .eq("show_on_homepage", true)
      .or(`end_at.is.null,end_at.gt.${nowIso}`)
      .or(`start_at.is.null,start_at.lte.${nowIso}`)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return null;
    announcements = (data ?? []) as HomeAnnouncement[];
  } catch {
    return null;
  }

  if (announcements.length === 0) return null;

  return <AnnouncementPopup items={announcements} />;
}