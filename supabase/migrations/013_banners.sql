-- ==========================================================
-- 013_banners.sql — ตาราง banners สำหรับ carousel หน้า member
-- ----------------------------------------------------------
-- admin/staff จัดการ banner ได้เอง (เพิ่ม/แก้ไข/ลบ/เรียงลำดับ)
-- รองรับ: รูปภาพ (อัปโหลด), badge, headline, subtitle, action_url
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.banners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(200) NOT NULL,
  badge       VARCHAR(100),
  headline    VARCHAR(300) NOT NULL,
  subtitle    TEXT,
  image_url   TEXT,            -- URL รูปภาพ (จาก storage หรือภายนอก)
  action_url  TEXT,            -- URL ที่จะพาไปเมื่อคลิก (ไม่บังคับ)
  action_label VARCHAR(50),   -- ข้อความปุ่ม เช่น "ดูเพิ่มเติม"
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- index สำหรับดึง banner ที่ active เรียงตาม sort_order
CREATE INDEX IF NOT EXISTS idx_banners_active_sort
  ON public.banners(is_active, sort_order);

-- ---------- RLS ----------
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- อ่านได้ทุกคน (anon + authenticated) — banner แสดงในหน้า member
CREATE POLICY "public_read_banners" ON public.banners
  FOR SELECT USING (true);

-- เขียน/แก้ไข/ลบ ได้เฉพาะ staff/admin
CREATE POLICY "staff_manage_banners" ON public.banners
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ));

-- ---------- updated_at trigger ----------
CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ==========================================================
-- Storage bucket: banners
-- สำหรับเก็บรูป banner ที่ admin อัปโหลด
-- ==========================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- อ่านได้ทุกคน (public bucket)
CREATE POLICY "public_read_banners_storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

-- อัปโหลด/แก้ไข/ลบ ได้เฉพาะ staff/admin
CREATE POLICY "staff_upload_banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff','admin')
    )
  );

CREATE POLICY "staff_update_banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff','admin')
    )
  );

CREATE POLICY "staff_delete_banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'banners'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff','admin')
    )
  );