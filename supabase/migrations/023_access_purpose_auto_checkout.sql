-- ==========================================================
-- 023_access_purpose_auto_checkout.sql — วัตถุประสงค์การเข้าใช้ + ปิด session อัตโนมัติ
-- ----------------------------------------------------------
-- dropdown_access_purposes: รายการ "มาทำอะไร" ที่ member เลือกตอนเช็คอิน
--   (เก็บเป็น TEXT (ชื่อ) ใน room_access_logs.purpose ตามเดิม ไม่ใช่ FK)
-- library_hours: เวลาเปิด-ปิดห้องสมุด รายวัน (7 วัน กำหนดเองได้)
-- auto_close_expired_sessions(): ปิด session ที่ member ลืมเช็คเอาท์
--   เมื่อพ้นเวลาปิดทำการของวันนั้น + เขียน note ว่าระบบปิดให้
-- room_access_logs.note: บันทึกว่าปิดโดยระบบ (auto) ไม่ใช่ตัว member
-- ==========================================================

-- ---------- 1. เพิ่มคอลัมน์ note ใน room_access_logs ----------
ALTER TABLE public.room_access_logs ADD COLUMN IF NOT EXISTS note TEXT;

-- ---------- 2. dropdown_access_purposes ----------
CREATE TABLE IF NOT EXISTS public.dropdown_access_purposes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  visible_to  TEXT[] NOT NULL DEFAULT ARRAY['student','teacher','staff','external'],
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

DROP INDEX IF EXISTS public.dropdown_access_purposes_name_ci_uq;
CREATE UNIQUE INDEX IF NOT EXISTS dropdown_access_purposes_name_ci_uq
  ON public.dropdown_access_purposes (lower(name));

-- seed ค่าเริ่มต้น (เฉพาะตอนยังว่าง)
INSERT INTO public.dropdown_access_purposes (name, sort_order)
SELECT name, sort_order
FROM (
  VALUES
    ('อ่านหนังสือ', 1),
    ('ยืม/คืนหนังสือ', 2),
    ('ศึกษาค้นคว้า', 3),
    ('ทำงานกลุ่ม', 4),
    ('ปรึกษาเจ้าหน้าที่', 5)
) AS seed(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.dropdown_access_purposes);

ALTER TABLE public.dropdown_access_purposes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_access_purposes_public" ON public.dropdown_access_purposes;
CREATE POLICY "select_access_purposes_public"
  ON public.dropdown_access_purposes FOR SELECT USING (true);

DROP POLICY IF EXISTS "modify_access_purposes_admin" ON public.dropdown_access_purposes;
CREATE POLICY "modify_access_purposes_admin"
  ON public.dropdown_access_purposes FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 3. library_hours (เวลาเปิด-ปิดห้องสมุด รายวัน) ----------
CREATE TABLE IF NOT EXISTS public.library_hours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 1=จันทร์ ... 7=อาทิตย์ (ISO day of week)
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  open_time     TIME NOT NULL DEFAULT '08:00',
  close_time    TIME NOT NULL DEFAULT '17:00',
  is_open       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  updated_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- ตรวจเวลาปิด > เวลาเปิด เฉพาะวันที่เปิดทำการเท่านั้น (วันปิดไม่ต้องตรวจ)
  CONSTRAINT chk_close_after_open CHECK (NOT is_open OR close_time > open_time),
  CONSTRAINT uq_library_hours_day UNIQUE (day_of_week)
);

-- seed 7 วัน: จ-ศ 08:00-17:00, ส 08:00-12:00, อา ปิด
INSERT INTO public.library_hours (day_of_week, open_time, close_time, is_open)
SELECT d.day_of_week, d.open_time, d.close_time, d.is_open
FROM (
  VALUES
    (1, TIME '08:00', TIME '17:00', true),   -- จันทร์
    (2, TIME '08:00', TIME '17:00', true),   -- อังคาร
    (3, TIME '08:00', TIME '17:00', true),   -- พุธ
    (4, TIME '08:00', TIME '17:00', true),   -- พฤหัสบดี
    (5, TIME '08:00', TIME '17:00', true),   -- ศุกร์
    (6, TIME '08:00', TIME '12:00', true),   -- เสาร์
    (7, TIME '08:00', TIME '08:00', false)   -- อาทิตย์ (ปิด)
) AS d(day_of_week, open_time, close_time, is_open)
WHERE NOT EXISTS (SELECT 1 FROM public.library_hours);

ALTER TABLE public.library_hours ENABLE ROW LEVEL SECURITY;

-- staff/admin จัดการได้, member อ่านได้ (ดูเวลาเปิด-ปิด)
DROP POLICY IF EXISTS "staff_manage_library_hours" ON public.library_hours;
CREATE POLICY "staff_manage_library_hours"
  ON public.library_hours FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff','admin')
  ));

DROP POLICY IF EXISTS "member_read_library_hours" ON public.library_hours;
CREATE POLICY "member_read_library_hours"
  ON public.library_hours FOR SELECT TO authenticated USING (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_library_hours_updated_at ON public.library_hours;
CREATE TRIGGER trg_library_hours_updated_at
  BEFORE UPDATE ON public.library_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 4. auto_close_expired_sessions() ----------
-- ปิด session ที่ member ลืมเช็คเอาท์ เมื่อพ้นเวลาปิดทำการของวันนั้น
-- ตั้ง check_out_at = เวลาปิดของวันจริง + เขียน note ว่าระบบปิดให้
CREATE OR REPLACE FUNCTION public.auto_close_expired_sessions()
RETURNS int AS $$
DECLARE
  v_closed int := 0;
  r RECORD;
BEGIN
  -- 4.1 วันที่มีเวลาเปิด-ปิด: ปิด session ที่เลยเวลาปิดของวันเข้าใช้
  FOR r IN
    SELECT day_of_week, close_time
    FROM public.library_hours
    WHERE is_open = true
  LOOP
    UPDATE public.room_access_logs
       SET check_out_at = ((check_in_at AT TIME ZONE 'Asia/Bangkok')::date + r.close_time) AT TIME ZONE 'Asia/Bangkok',
           note = 'ระบบปิดให้อัตโนมัติ เนื่องจากเกินเวลาปิดห้องสมุด'
     WHERE check_out_at IS NULL
       AND EXTRACT(ISODOW FROM check_in_at AT TIME ZONE 'Asia/Bangkok') = r.day_of_week
       AND now() > ((check_in_at AT TIME ZONE 'Asia/Bangkok')::date + r.close_time) AT TIME ZONE 'Asia/Bangkok';
    v_closed := v_closed + 1;
  END LOOP;

  -- 4.2 วันปิดทำการ (is_open = false): ปิด session ที่ค้างจากวันนั้นทันที
  FOR r IN
    SELECT day_of_week
    FROM public.library_hours
    WHERE is_open = false
  LOOP
    UPDATE public.room_access_logs
       SET check_out_at = now(),
           note = 'ระบบปิดให้อัตโนมัติ เนื่องจากเป็นวันปิดทำการห้องสมุด'
     WHERE check_out_at IS NULL
       AND EXTRACT(ISODOW FROM check_in_at AT TIME ZONE 'Asia/Bangkok') = r.day_of_week;
    v_closed := v_closed + 1;
  END LOOP;

  RETURN v_closed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
