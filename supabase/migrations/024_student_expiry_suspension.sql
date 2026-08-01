-- ==========================================================
-- 024_student_expiry_suspension.sql
-- ระบบ "พ้นสภาพการเป็นนักศึกษา" + ระงับบัญชีพร้อมเหตุผล
-- ----------------------------------------------------------
-- 1. dropdown_class_groups:
--    - start_date      วันที่เริ่มนับระยะเวลานักศึกษา (admin กรอกเอง)
--    - duration_years  จำนวนปีของหลักสูตร (ปวช=3, ปวส=2 — admin กำหนดเองต่อกลุ่ม)
--    วันพ้นสภาพคำนวณแบบ virtual = start_date + duration_years
-- 2. users:
--    - suspended_reason  เหตุผลการระงับ (admin กรอกตอนกดระงับ)
--    - suspended_at      เวลาที่ระงับ
--    - suspended_by      ผู้ที่ระงับ (FK -> users.id)
-- ==========================================================

-- ---------- 1. dropdown_class_groups: start_date + duration_years ----------
ALTER TABLE public.dropdown_class_groups
  ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.dropdown_class_groups
  ADD COLUMN IF NOT EXISTS duration_years INTEGER NOT NULL DEFAULT 3
  CHECK (duration_years > 0);

-- ---------- 2. users: ข้อมูลการระงับ ----------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ---------- 3. index สำหรับค้นหาสมาชิกที่ถูกระงับ ----------
DROP INDEX IF EXISTS idx_users_suspended;
CREATE INDEX idx_users_suspended ON public.users(status, suspended_at)
  WHERE status = 'suspended';
