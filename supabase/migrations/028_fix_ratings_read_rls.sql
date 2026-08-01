-- ==========================================================
-- Migration 028 — แก้ RLS ของ book_ratings
-- ----------------------------------------------------------
-- ปัญหา: policy "member_all_own_ratings" (migration 005) ใช้ FOR ALL
--   โดย USING (user_id = auth.uid()) ทำให้ member SELECT ได้เฉพาะแถว
--   ของตัวเอง → ดาวเฉลี่ยบนหน้า member คำนวณจาก rating ของตัวเองเท่านั้น
-- วิธีแก้: แยก policy เป็น
--   • member อ่าน rating ทั้งหมดได้ (อ่านเพื่อคำนวณดาวเฉลี่ย)
--   • member เขียน/แก้/ลบ ได้เฉพาะของตัวเอง
--   • staff/admin เห็นและจัดการทั้งหมด (คงเดิม)
-- ==========================================================

-- ยกเลิก policy เดิม (FOR ALL ของ member) ก่อน
DROP POLICY IF EXISTS "member_all_own_ratings" ON public.book_ratings;

-- member อ่าน rating ทั้งหมดได้
CREATE POLICY "member_read_all_ratings"
  ON public.book_ratings FOR SELECT
  USING (true);

-- member เขียน/แก้/ลบ ได้เฉพาะของตัวเอง
CREATE POLICY "member_write_own_ratings"
  ON public.book_ratings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "member_update_own_ratings"
  ON public.book_ratings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "member_delete_own_ratings"
  ON public.book_ratings FOR DELETE
  USING (user_id = auth.uid());

-- ==========================================================
-- จบ Migration 028
-- ==========================================================
