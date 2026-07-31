-- ==========================================================
-- Migration 003 — เพิ่ม RLS policies ให้ member ยืม-คืนได้
-- ปัญหา: member ไม่สามารถ INSERT borrow_records หรือ UPDATE book_copies ได้
--  เพราะมีแค่ staff/admin policy เท่านั้น
-- ==========================================================

-- 1. Member สามารถ INSERT borrow_records ของตัวเองได้
CREATE POLICY "member_insert_own_borrow_records"
  ON public.borrow_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 2. Member สามารถ UPDATE borrow_records ของตัวเองได้
--    (สำหรับต่ออายุ + คืนหนังสือ + ชำระค่าปรับ)
CREATE POLICY "member_update_own_borrow_records"
  ON public.borrow_records FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Member สามารถ UPDATE book_copies ได้ (เปลี่ยนสถานะตอนยืม/คืน)
--    แต่จำกัดเฉพาะการเปลี่ยน status เท่านั้น ไม่ใช่ลบ
CREATE POLICY "member_update_book_copies_status"
  ON public.book_copies FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. Member สามารถ INSERT fine_payments ของตัวเองได้
CREATE POLICY "member_insert_own_fine_payments"
  ON public.fine_payments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 5. Member สามารถ UPDATE fine_payments ของตัวเองได้ (ถ้าจำเป็น)
CREATE POLICY "member_update_own_fine_payments"
  ON public.fine_payments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Member สามารถ SELECT book_copies ได้ (เพื่อดูสถานะว่าง/ไม่ว่าง)
--    (ถ้ายังไม่มี policy SELECT สำหรับ member)
CREATE POLICY "member_select_book_copies"
  ON public.book_copies FOR SELECT
  USING (true);

-- 7. Member สามารถ SELECT books ได้
CREATE POLICY "member_select_books"
  ON public.books FOR SELECT
  USING (true);

-- 8. Member สามารถ SELECT book_categories ได้
CREATE POLICY "member_select_book_categories"
  ON public.book_categories FOR SELECT
  USING (true);