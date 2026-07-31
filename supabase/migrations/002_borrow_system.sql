-- ==========================================================
-- Migration 002 — ระบบยืม-คืนหนังสือ
-- เพิ่ม: extension_count, trigger คำนวณ overdue อัตโนมัติ
-- ==========================================================

-- 1. เพิ่ม column extension_count เพื่อจำกัดการขยายเวลา (สูงสุด 1 ครั้ง)
ALTER TABLE public.borrow_records
  ADD COLUMN IF NOT EXISTS extension_count INT NOT NULL DEFAULT 0;

-- 2. Trigger อัปเดต status เป็น 'overdue' อัตโนมัติเมื่อเกิน due_date
CREATE OR REPLACE FUNCTION public.fn_mark_overdue()
RETURNS TRIGGER AS $$
BEGIN
  -- ถ้ายังไม่คืน + เลย due_date + สถานะยังเป็น borrowing → เปลี่ยนเป็น overdue
  IF NEW.returned_at IS NULL
     AND NEW.status = 'borrowing'
     AND NEW.due_date < now() THEN
    NEW.status := 'overdue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_mark_overdue ON public.borrow_records;
CREATE TRIGGER trg_mark_overdue
  BEFORE UPDATE OR INSERT ON public.borrow_records
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_mark_overdue();

-- 3. RLS policies สำหรับ borrow_records
--    - เจ้าหน้าที่ (staff/admin): ดู/แก้ไขได้ทั้งหมด
--    - สมาชิก: ดูได้เฉพาะของตัวเอง
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;

-- policy: staff/admin เห็นทั้งหมด
CREATE POLICY "staff_all_borrow_records"
  ON public.borrow_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('staff', 'admin')
    )
  );

-- policy: member เห็นเฉพาะของตัวเอง (SELECT เท่านั้น)
CREATE POLICY "member_own_borrow_records"
  ON public.borrow_records FOR SELECT
  USING (user_id = auth.uid());

-- 4. RLS สำหรับ book_copies — อนุญาตให้ staff อัปเดตสถานะ
--    (เดิมอาจจะมี policy เฉพาะ admin — เพิ่มให้ staff ได้)
CREATE POLICY "staff_update_book_copies"
  ON public.book_copies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('staff', 'admin')
    )
  );

-- 5. RLS สำหรับ fine_payments (staff/admin จัดการได้)
ALTER TABLE public.fine_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_fine_payments"
  ON public.fine_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('staff', 'admin')
    )
  );

CREATE POLICY "member_own_fine_payments"
  ON public.fine_payments FOR SELECT
  USING (user_id = auth.uid());