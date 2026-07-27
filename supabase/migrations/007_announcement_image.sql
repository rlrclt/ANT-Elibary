-- ==========================================================
-- 007_announcement_image.sql — เพิ่มฟิลด์ image_url ใน announcements
-- ==========================================================

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS image_url TEXT;