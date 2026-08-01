-- ==========================================================
-- 021_damaged_book_system.sql — ระบบหนังสือชำรุด + การชดใช้เต็มราคา + เล่มทดแทน
-- ----------------------------------------------------------
-- damaged_records: บันทึกเหตุการณ์หนังสือชำรุดต่อเล่มลูก (ประวัติ timeline)
--   - ผูกกับ borrow_record ที่ตรวจพบ + user ที่รับผิดชอบ
--   - status: unresolved (ค้างชดใช้) | paid (จ่ายเงินแล้ว) | replaced (ซื้อเล่มคืนแล้ว)
--   - resolution_method: payment | replacement
--   - fine_amount = ราคาเต็มจาก book_copies.price
-- fine_payments.damaged_record_id: เชื่อมการชำระ (สลิป/เคาน์เตอร์) เข้ากับรายการชำรุด
-- ==========================================================

-- ---------- 1. damaged_records ----------
CREATE TABLE IF NOT EXISTS public.damaged_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_copy_id        UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE RESTRICT,
  borrow_record_id    UUID REFERENCES public.borrow_records(id) ON DELETE RESTRICT,
  -- สมาชิกผู้รับผิดชอบ (คนที่ยืมและทำให้ชำรุด)
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  -- สถานะการชดใช้
  status              VARCHAR(20) NOT NULL DEFAULT 'unresolved'
                      CHECK (status IN ('unresolved', 'paid', 'replaced')),
  -- วิธีชดใช้ (ถ้าจัดการแล้ว)
  resolution_method   VARCHAR(20) CHECK (resolution_method IN ('payment', 'replacement')),
  -- ยอดชดใช้เต็มราคาเล่ม
  fine_amount         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
  -- เชื่อมกับ fine_payment (กรณีจ่ายเงิน)
  fine_payment_id     UUID REFERENCES public.fine_payments(id) ON DELETE SET NULL,
  -- สมาชิกที่นำเล่มใหม่มาคืน (กรณี replacement) — เลือกได้ ไม่จำเป็นต้องเป็นคนที่ทำชำรุด
  replacement_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  note                TEXT,
  -- staff/admin ที่ทำรายการ
  handled_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_resolved_has_method CHECK (
    (status = 'unresolved' AND resolution_method IS NULL)
    OR (status <> 'unresolved' AND resolution_method IS NOT NULL)
  )
);

-- index
CREATE INDEX IF NOT EXISTS idx_damaged_copies         ON public.damaged_records(book_copy_id);
CREATE INDEX IF NOT EXISTS idx_damaged_user           ON public.damaged_records(user_id);
CREATE INDEX IF NOT EXISTS idx_damaged_status         ON public.damaged_records(status);
CREATE INDEX IF NOT EXISTS idx_damaged_created        ON public.damaged_records(created_at DESC);

-- RLS
ALTER TABLE public.damaged_records ENABLE ROW LEVEL SECURITY;

-- staff/admin เห็นทั้งหมด
CREATE POLICY "staff_all_damaged_records" ON public.damaged_records
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ));

-- member เห็นเฉพาะของตัวเอง
CREATE POLICY "member_own_damaged_records" ON public.damaged_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_damaged_records_updated_at ON public.damaged_records;
CREATE TRIGGER trg_damaged_records_updated_at
  BEFORE UPDATE ON public.damaged_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 2. fine_payments.damaged_record_id ----------
-- เชื่อมการชำระ (สลิป/เคาน์เตอร์) เข้ากับรายการชำรุด
ALTER TABLE public.fine_payments
  ADD COLUMN IF NOT EXISTS damaged_record_id UUID
  REFERENCES public.damaged_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fine_payments_damaged
  ON public.fine_payments(damaged_record_id)
  WHERE damaged_record_id IS NOT NULL;
