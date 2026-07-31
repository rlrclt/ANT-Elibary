-- ==========================================================
-- 014_fine_system.sql — ระบบค่าปรับ + การชำระเงิน
-- ----------------------------------------------------------
-- fine_settings: ตั้งค่าค่าปรับ (อัตราต่อวัน, เปอร์เซ็นต์เสียหาย)
-- fine_payments: การชำระค่าปรับ (สลิป, สถานะ, การอนุมัติ)
-- payment_methods: QR code บัญชี (แอดมินอัปโหลด)
-- ==========================================================

-- ---------- 1. fine_settings ----------
CREATE TABLE IF NOT EXISTS public.fine_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- ค่าปรับล่าช้า: บาทต่อวัน
  overdue_rate    DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  -- ถ้าเกินกี่วัน → ปรับเต็มราคาเล่ม
  overdue_max_days INT NOT NULL DEFAULT 30,
  -- เปอร์เซ็นต์ค่าปรับตามสภาพ (ของราคาเล่ม)
  damage_new_pct      DECIMAL(5,2) NOT NULL DEFAULT 0,     -- มือหนึ่ง: 0%
  damage_good_pct     DECIMAL(5,2) NOT NULL DEFAULT 50,    -- สภาพดี: 50%
  damage_fair_pct     DECIMAL(5,2) NOT NULL DEFAULT 75,    -- พอใช้: 75%
  damage_poor_pct     DECIMAL(5,2) NOT NULL DEFAULT 100,   -- ชำรุด: 100%
  -- สถานะ
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- แอดมินที่แก้ล่าสุด
  updated_by      UUID REFERENCES public.users(id)
);

-- สร้าง row default ถ้ายังไม่มี
INSERT INTO public.fine_settings (id, is_active)
SELECT uuid_generate_v4(), true
WHERE NOT EXISTS (SELECT 1 FROM public.fine_settings WHERE is_active = true);

-- RLS: staff/admin จัดการได้, member อ่านได้ (เพื่อดูอัตรา)
ALTER TABLE public.fine_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_manage_fine_settings" ON public.fine_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ));

CREATE POLICY "member_read_fine_settings" ON public.fine_settings
  FOR SELECT TO authenticated USING (is_active = true);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_fine_settings_updated_at ON public.fine_settings;
CREATE TRIGGER trg_fine_settings_updated_at
  BEFORE UPDATE ON public.fine_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 2. fine_payments ----------
-- ทิ้งตารางเดิม (schema จาก 001_init_schema) แล้วสร้างใหม่ด้วย schema ที่อัปเดตแล้ว
-- CASCADE เพื่อลบ index / trigger / policy ที่ผูกอยู่ด้วย
DROP TABLE IF EXISTS public.fine_payments CASCADE;
CREATE TABLE public.fine_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id),
  borrow_record_id UUID REFERENCES public.borrow_records(id),
  -- ประเภทค่าปรับ
  fine_type       VARCHAR(20) NOT NULL DEFAULT 'overdue',  -- overdue | damaged | lost | other
  -- จำนวนเงิน
  amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- รายละเอียด
  description     TEXT,
  -- การชำระ
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'transfer', -- transfer | counter
  slip_url        TEXT,        -- URL สลิป (ถ้าโอน)
  slip_uploaded_at TIMESTAMPTZ,
  -- สถานะ
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | counter_paid
  reviewed_by     UUID REFERENCES public.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  -- วันที่
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- index
CREATE INDEX IF NOT EXISTS idx_fine_payments_user ON public.fine_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_fine_payments_status ON public.fine_payments(status);
CREATE INDEX IF NOT EXISTS idx_fine_payments_created ON public.fine_payments(created_at DESC);

-- RLS
ALTER TABLE public.fine_payments ENABLE ROW LEVEL SECURITY;

-- member เห็นแค่ของตัวเอง
CREATE POLICY "member_own_fine_payments" ON public.fine_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "member_insert_fine_payments" ON public.fine_payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "member_update_own_fine_payments" ON public.fine_payments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- staff/admin เห็นทั้งหมด
CREATE POLICY "staff_all_fine_payments" ON public.fine_payments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_fine_payments_updated_at ON public.fine_payments;
CREATE TRIGGER trg_fine_payments_updated_at
  BEFORE UPDATE ON public.fine_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- sync fine_balance ใน users — recreate หลัง DROP TABLE CASCADE ลบของเดิมไปด้วย
DROP TRIGGER IF EXISTS trg_sync_fine_payment ON public.fine_payments;
CREATE TRIGGER trg_sync_fine_payment
  AFTER INSERT OR UPDATE OF amount, status OR DELETE ON public.fine_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_fine_balance();

-- ---------- 3. payment_methods (QR code บัญชี) ----------
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,       -- ชื่อบัญชี เช่น "ธนาคารกสิกรไทย"
  account_name    VARCHAR(100),                -- ชื่อเจ้าของบัญชี
  account_number  VARCHAR(50),                 -- เลขบัญชี
  qr_image_url    TEXT,                        -- URL QR code (ใน bucket media)
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: ทุกคนอ่านได้ (แสดงหน้าชำระ), staff/admin จัการได้
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_payment_methods" ON public.payment_methods
  FOR SELECT USING (is_active = true);

CREATE POLICY "staff_manage_payment_methods" ON public.payment_methods
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER trg_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();