-- ==========================================================
-- 026_return_photo_review.sql — ระบบคืนหนังสือพร้อมรูปถ่าย + รอตรวจสอบ
-- ----------------------------------------------------------
-- 1. borrow_records: เพิ่มคอลัมน์ขอคืน + สถานะ pending_return
--    - return_requested_at  วันที่ member ขอคืน (เริ่มนับ 7 วัน)
--    - return_photo_url     รูปถ่ายหนังสือตอนขอคืน (bucket media)
--    - return_condition     สภาพหนังสือที่ member เลือก (ปกติ/ชำรุดเล็กน้อย/ชำรุดเสียหาย)
--    - status เพิ่ม 'pending_return' — ค้างรอ staff ตรวจสอบ
-- 2. fine_payments: เพิ่ม receipt_number (เลขใบเสร็จ สำหรับพิมพ์ใบเสร็จค่าปรับ)
-- ==========================================================

-- ---------- 1. borrow_records ----------
-- ขยาย CHECK สถานะให้รวม 'pending_return'
ALTER TABLE public.borrow_records DROP CONSTRAINT IF EXISTS borrow_records_status_check;
ALTER TABLE public.borrow_records ADD CONSTRAINT borrow_records_status_check
  CHECK (status IN ('borrowing', 'returned', 'overdue', 'lost', 'pending_return'));

-- เพิ่มคอลัมน์ขอคืน
ALTER TABLE public.borrow_records
  ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS return_condition VARCHAR(20)
    CHECK (return_condition IN ('normal', 'slight_damage', 'damaged'));

-- index สำหรับดึงรายการที่รอตรวจสอบ
CREATE INDEX IF NOT EXISTS idx_borrow_records_return_pending
  ON public.borrow_records(return_requested_at)
  WHERE status = 'pending_return';

-- ---------- 2. fine_payments ----------
-- เลขใบเสร็จ (ออกโดย staff/admin เมื่อเก็บค่าปรับที่เคาน์เตอร์)
ALTER TABLE public.fine_payments
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;

CREATE INDEX IF NOT EXISTS idx_fine_payments_receipt
  ON public.fine_payments(receipt_number)
  WHERE receipt_number IS NOT NULL;
