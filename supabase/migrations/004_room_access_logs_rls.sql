-- ==========================================================
-- Migration 004 — RLS policies สำหรับ room_access_logs
-- ตารางนี้มีอยู่แล้วใน 001_init_schema.sql แต่ยังไม่มี RLS
-- ==========================================================

-- 1. เปิด RLS
ALTER TABLE public.room_access_logs ENABLE ROW LEVEL SECURITY;

-- 2. Member สามารถ INSERT ของตัวเองได้ (check-in)
CREATE POLICY "member_insert_own_access_log"
  ON public.room_access_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. Member สามารถ SELECT ของตัวเองได้ (ดูประวัติ)
CREATE POLICY "member_select_own_access_logs"
  ON public.room_access_logs FOR SELECT
  USING (user_id = auth.uid());

-- 4. Member สามารถ UPDATE ของตัวเองได้ (check-out — แก้ check_out_at)
CREATE POLICY "member_update_own_access_log"
  ON public.room_access_logs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Staff/Admin สามารถ SELECT/INSERT/UPDATE ได้ทั้งหมด
CREATE POLICY "staff_all_access_logs"
  ON public.room_access_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('staff', 'admin')
    )
  );

-- 6. Member สามารถ SELECT users ได้ (เผื่อต้องดูชื่อตัวเอง)
--    ถ้ายังไม่มี policy SELECT สำหรับ member บน users
CREATE POLICY "member_select_users_basic"
  ON public.users FOR SELECT
  USING (true);