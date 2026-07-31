-- ==========================================================
-- 009_system_notifications.sql — ระบบแจ้งเตือนอัตโนมัติ
-- ----------------------------------------------------------
-- ตาราง system_notifications: เก็บการแจ้งเตือนที่ระบบสร้างอัตโนมัติ
--   เมื่อเกิดเหตุการณ์ในระบบ (ยืม/คืน/เข้าห้องสมุด/บัญชี)
-- แยกจาก announcements (ที่แอดมินสร้างเอง + schedule + show_on_homepage)
--
-- Triggers:
--   1. borrow_records AFTER INSERT  → "ยืมหนังสือสำเร็จ"
--   2. borrow_records AFTER UPDATE   → "คืนหนังสือสำเร็จ" (status borrowing→returned)
--   3. room_access_logs AFTER INSERT → "เช็คอินห้องสมุด"
--   4. room_access_logs AFTER UPDATE  → "เช็คเอาท์ห้องสมุด"
--   5. users AFTER UPDATE            → "บัญชีถูกระงับ" / "เปลี่ยนอีเมล"
--
-- "ใกล้ครบกำหนด/เกินกำหนด" ไม่ใช้ trigger — คำนวณตอนโหลดหน้า
-- ==========================================================

-- ---------- ตาราง system_notifications ----------
CREATE TABLE IF NOT EXISTS public.system_notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category     VARCHAR(20) NOT NULL
               CHECK (category IN ('loan', 'access', 'account')),
  event_type   VARCHAR(40) NOT NULL,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  ref_id       UUID,
  action_url   VARCHAR(200),
  icon         VARCHAR(40) NOT NULL DEFAULT 'bell',
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sys_notif_user
  ON public.system_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sys_notif_unread
  ON public.system_notifications(user_id, is_read)
  WHERE is_read = false;

-- ---------- RLS ----------
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- user เห็น/อัปเดตเฉพาะของตัวเอง
CREATE POLICY "user_own_notifications_select" ON public.system_notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_own_notifications_update" ON public.system_notifications
  FOR UPDATE USING (user_id = auth.uid());
-- staff/admin เห็นทั้งหมด (สำหรับรายงาน/ดีบั๊ก)
CREATE POLICY "staff_all_notifications_select" ON public.system_notifications
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ));
-- ไม่มี INSERT policy สำหรับ user — INSERT เกิดจาก trigger เท่านั้น
-- trigger ทำงานในสิทธิ์ของตาราง (SECURITY DEFINER ไม่จำเป็นเพราะ
--   trigger function ทำงานหลัง INSERT/UPDATE ของตารางที่ user มีสิทธิ์อยู่แล้ว)
-- แต่เพื่อให้ trigger insert ได้ ต้องมี policy ที่อนุญาต INSERT
CREATE POLICY "trigger_insert_notifications" ON public.system_notifications
  FOR INSERT WITH CHECK (true);

-- ==========================================================
-- TRIGGER FUNCTIONS
-- ==========================================================

-- ---------- 1. ยืมหนังสือสำเร็จ ----------
-- เกิดหลัง INSERT borrow_records (สถานะเริ่มต้น 'borrowing')
CREATE OR REPLACE FUNCTION public.trg_notify_borrow_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_book_title TEXT;
BEGIN
  -- ดึงชื่อหนังสือ: borrow_records.book_copy_id → book_copies.book_id → books.title
  SELECT b.title INTO v_book_title
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.id = NEW.book_copy_id
  LIMIT 1;

  INSERT INTO public.system_notifications
    (user_id, category, event_type, title, body, ref_id, action_url, icon)
  VALUES (
    NEW.user_id,
    'loan',
    'borrowed',
    'ยืมหนังสือสำเร็จ',
    'คุณยืม "' || COALESCE(v_book_title, 'หนังสือ') || '" ครบกำหนดคืน ' ||
      to_char(NEW.due_date AT TIME ZONE 'Asia/Bangkok', 'DD/MM/YYYY HH24:นานา'),
    NEW.id,
    '/member/loans',
    'book-open'
  );
  RETURN NEW;
END;
$$;

-- ---------- 2. คืนหนังสือสำเร็จ ----------
-- เกิดหลัง UPDATE borrow_records เมื่อ status เปลี่ยน borrowing→returned
CREATE OR REPLACE FUNCTION public.trg_notify_returned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_book_title TEXT;
BEGIN
  -- เกิดเฉพาะเมื่อ status เปลี่ยนจาก 'borrowing'/'overdue' เป็น 'returned'
  IF NOT (OLD.status IN ('borrowing','overdue') AND NEW.status = 'returned') THEN
    RETURN NEW;
  END IF;

  SELECT b.title INTO v_book_title
  FROM public.book_copies bc
  JOIN public.books b ON b.id = bc.book_id
  WHERE bc.id = NEW.book_copy_id
  LIMIT 1;

  INSERT INTO public.system_notifications
    (user_id, category, event_type, title, body, ref_id, action_url, icon)
  VALUES (
    NEW.user_id,
    'loan',
    'returned',
    'คืนหนังสือสำเร็จ',
    'คุณคืน "' || COALESCE(v_book_title, 'หนังสือ') || '" เรียบร้อยแล้ว' ||
      CASE WHEN NEW.fine_amount > 0
        THEN ' (มีค่าปรับ ' || NEW.fine_amount || ' บาท)'
        ELSE ''
      END,
    NEW.id,
    '/member/loans',
    'book'
  );
  RETURN NEW;
END;
$$;

-- ---------- 3. เช็คอินห้องสมุด ----------
-- เกิดหลัง INSERT room_access_logs (check_in_at ถูกตั้ง default now)
CREATE OR REPLACE FUNCTION public.trg_notify_checked_in()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- ถ้าไม่มี user_id (guest หรือ user ถูกลบ) ไม่แจ้ง
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.system_notifications
    (user_id, category, event_type, title, body, ref_id, action_url, icon)
  VALUES (
    NEW.user_id,
    'access',
    'checked_in',
    'เช็คอินห้องสมุด',
    'คุณเข้าใช้ห้องสมุดเวลา ' ||
      to_char(NEW.check_in_at AT TIME ZONE 'Asia/Bangkok', 'HH24:นานา น.'),
    NEW.id,
    '/member/access',
    'door-open'
  );
  RETURN NEW;
END;
$$;

-- ---------- 4. เช็คเอาท์ห้องสมุด ----------
-- เกิดหลัง UPDATE room_access_logs เมื่อ check_out_at ถูกตั้งค่า
CREATE OR REPLACE FUNCTION public.trg_notify_checked_out()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_duration_min INT;
BEGIN
  -- เกิดเฉพาะเมื่อ check_out_at เปลี่ยนจาก NULL เป็นค่าจริง
  IF NOT (OLD.check_out_at IS NULL AND NEW.check_out_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_duration_min := EXTRACT(EPOCH FROM (NEW.check_out_at - NEW.check_in_at)) / 60;

  INSERT INTO public.system_notifications
    (user_id, category, event_type, title, body, ref_id, action_url, icon)
  VALUES (
    NEW.user_id,
    'access',
    'checked_out',
    'เช็คเอาท์ห้องสมุด',
    'คุณใช้เวลาในห้องสมุด ' ||
      CASE WHEN v_duration_min >= 60
        THEN (v_duration_min / 60) || ' ชม. ' || (v_duration_min % 60) || ' นาที'
        ELSE v_duration_min || ' นาที'
      END,
    NEW.id,
    '/member/access',
    'door'
  );
  RETURN NEW;
END;
$$;

-- ---------- 5. บัญชี: ถูกระงับ / เปลี่ยนอีเมล ----------
CREATE OR REPLACE FUNCTION public.trg_notify_account_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- กรณี: บัญชีถูกระงับ (active → suspended)
  IF OLD.status = 'active' AND NEW.status = 'suspended' THEN
    INSERT INTO public.system_notifications
      (user_id, category, event_type, title, body, action_url, icon)
    VALUES (
      NEW.id,
      'account',
      'suspended',
      'บัญชีถูกระงับ',
      'บัญชีของคุณถูกระงับชั่วคราว กรุณาติดต่อเจ้าหน้าที่',
      '/contact',
      'prohibit'
    );
  END IF;

  -- กรณี: เปลี่ยนอีเมล
  IF OLD.email IS DISTINCT FROM NEW.email AND NEW.email IS NOT NULL THEN
    INSERT INTO public.system_notifications
      (user_id, category, event_type, title, body, action_url, icon)
    VALUES (
      NEW.id,
      'account',
      'email_changed',
      'เปลี่ยนอีเมลสำเร็จ',
      'อีเมลของคุณถูกเปลี่ยนเป็น ' || NEW.email,
      '/member/profile',
      'at'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================================
-- TRIGGERS (หลังฟังก์ชันทั้งหมดถูกสร้างแล้ว)
-- ==========================================================

-- 1. ยืมหนังสือ
DROP TRIGGER IF EXISTS trg_notify_borrow_created ON public.borrow_records;
CREATE TRIGGER trg_notify_borrow_created
  AFTER INSERT ON public.borrow_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_borrow_created();

-- 2. คืนหนังสือ
DROP TRIGGER IF EXISTS trg_notify_returned ON public.borrow_records;
CREATE TRIGGER trg_notify_returned
  AFTER UPDATE ON public.borrow_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_returned();

-- 3. เช็คอิน
DROP TRIGGER IF EXISTS trg_notify_checked_in ON public.room_access_logs;
CREATE TRIGGER trg_notify_checked_in
  AFTER INSERT ON public.room_access_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_checked_in();

-- 4. เช็คเอาท์
DROP TRIGGER IF EXISTS trg_notify_checked_out ON public.room_access_logs;
CREATE TRIGGER trg_notify_checked_out
  AFTER UPDATE ON public.room_access_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_checked_out();

-- 5. บัญชี
DROP TRIGGER IF EXISTS trg_notify_account_change ON public.users;
CREATE TRIGGER trg_notify_account_change
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_account_change();