-- ==========================================================
-- 008_announcement_schedule.sql — เพิ่มระยะเวลาประกาศ + แสดงบนหน้าแรก
-- ----------------------------------------------------------
-- เพิ่ม: start_at, end_at, show_on_homepage ใน announcements
-- start_at: วันที่เริ่มแสดง (null = แสดงทันที)
-- end_at: วันที่หมดอายุ (null = ไม่หมดอายุ)
-- show_on_homepage: แสดง popup บนหน้าแรกไหม
-- ==========================================================

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_announcements_homepage
  ON public.announcements(show_on_homepage, is_active, created_at DESC)
  WHERE show_on_homepage = true AND is_active = true;