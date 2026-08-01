-- ==========================================================
-- 022_book_copy_removal.sql — ลบเล่มลูกแบบ soft-delete + audit log
-- ----------------------------------------------------------
-- เป้าหมาย:
--   - ให้ staff/admin ลบเล่มลูก (book_copies) ออกจากระบบได้
--     โดยใช้ status='removed' (soft-delete) ไม่ลบแถวจริง
--   - บันทึกการลบลงตาราง book_copy_logs (ใครลบ / เมื่อไหร่ / หมายเหตุ)
--   - ประวัติยืม-คืน / ชำรุด ทั้งหมดยังคงอยู่ครบ (FK RESTRICT ไว้แล้ว)
--   - ปรับ trg_sync_book_counts ให้ไม่นับเล่มที่ถูกลบใน total_copies
-- ==========================================================

-- ---------- 1. ขยาย CHECK ให้ book_copies มีสถานะ 'removed' ----------
-- ตอนนี้ CHECK เดิม (inline ใน CREATE TABLE) อนุญาตแค่
-- available/borrowed/lost/damaged — drop แล้วสร้างใหม่เพิ่ม 'removed'
ALTER TABLE public.book_copies
  DROP CONSTRAINT IF EXISTS book_copies_status_check;

ALTER TABLE public.book_copies
  ADD CONSTRAINT book_copies_status_check
  CHECK (status IN ('available', 'borrowed', 'lost', 'damaged', 'removed'));

-- ---------- 2. ปรับ trg_sync_book_counts ไม่นับเล่มที่ถูกลบ ----------
-- เดิม: total_copies = COUNT(*) ทั้งหมด
-- ใหม่: กัน status='removed' ออก (available_copies เดิมกรองแค่ 'available' อยู่แล้ว)
CREATE OR REPLACE FUNCTION public.trg_sync_book_counts()
RETURNS trigger AS $$
DECLARE
  v_book_id UUID;
BEGIN
  v_book_id := COALESCE(NEW.book_id, OLD.book_id);
  UPDATE public.books
  SET total_copies = (SELECT COUNT(*) FROM public.book_copies
                      WHERE book_id = v_book_id AND status <> 'removed'),
      available_copies = (SELECT COUNT(*) FROM public.book_copies
                          WHERE book_id = v_book_id AND status = 'available')
  WHERE id = v_book_id;
  RETURN NULL; -- statement นี้เป็น AFTER trigger ไม่ต้อง return NEW/OLD จริงจัง
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------- 3. ตาราง audit log การลบเล่มลูก ----------
-- บันทึกการ action ที่ทำโดยใคร เมื่อไหร่ เพื่อตรวจสอบย้อนหลัง
CREATE TABLE IF NOT EXISTS public.book_copy_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_copy_id   UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE RESTRICT,
  book_id        UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  barcode        VARCHAR(50) NOT NULL,
  action         VARCHAR(20) NOT NULL DEFAULT 'removed'
                 CHECK (action IN ('removed')),
  -- หมายเหตุ/เหตุผลที่ลบ (ถ้ามี)
  note           TEXT,
  -- staff/admin ที่ทำรายการ
  handled_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- index
CREATE INDEX IF NOT EXISTS idx_book_copy_logs_copy   ON public.book_copy_logs(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_book_copy_logs_book   ON public.book_copy_logs(book_id);
CREATE INDEX IF NOT EXISTS idx_book_copy_logs_created ON public.book_copy_logs(created_at DESC);

-- RLS — staff/admin เท่านั้น (สมาชิกมองไม่เห็น)
ALTER TABLE public.book_copy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_book_copy_logs" ON public.book_copy_logs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ));
