-- ==========================================================
-- 011_notification_queue.sql — Notification Queue สำหรับ Retry อัตโนมัติ
-- ----------------------------------------------------------
-- รองรับสถาปัตยกรรม: Server Action + after() + Notification Queue
--
-- flow ใหม่:
--   1. Server Action (ยืม/คืน) บันทึกข้อมูล + INSERT notification_queue (status='pending')
--   2. after(() => ส่ง LINE) ทันทีหลัง response กลับไปแล้ว
--      - ส่งสำเร็จ → status='sent'
--      - ส่งไม่สำเร็จ → คง status='pending' พร้อม attempts + last_attempt_at
--   3. Cron (Vercel Cron ทุก 1 นาที) ดึง pending มาส่งใหม่จนกว่าจะสำเร็จ
--
-- การยืม/คืนหนังสือ (Critical) ไม่ขึ้นกับการส่ง LINE (Non-Critical)
-- ==========================================================

-- ---------- ตาราง notification_queue ----------
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel         VARCHAR(20) NOT NULL DEFAULT 'line'
                  CHECK (channel IN ('line','email','discord','push')),
  -- เก็บ payload ที่จะส่ง (title, body, action_url, icon, category)
  payload         JSONB NOT NULL,
  -- สถานะ: pending (รอส่ง/รอ retry), sent (ส่งแล้ว), failed (ล้มเหลวถาวร)
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','failed')),
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 5,
  last_attempt_at TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  last_error      TEXT,
  -- ref ไปยัง system_notifications (ถ้ามี) เพื่อ track ความเชื่อมโยง
  notification_id UUID REFERENCES public.system_notifications(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- index สำหรับดึง pending (cron ดึงทีละ batch)
CREATE INDEX IF NOT EXISTS idx_notif_queue_pending
  ON public.notification_queue(status, created_at)
  WHERE status = 'pending';

-- index สำหรับดึงตาม user
CREATE INDEX IF NOT EXISTS idx_notif_queue_user
  ON public.notification_queue(user_id, created_at DESC);

-- ---------- RLS ----------
-- ใช้ service_role ใน server action/cron (ข้าม RLS)
-- user ทั่วไปไม่ควรอ่าน/เขียน queue โดยตรง
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- ลบ policy เก่าก่อน (ถ้ารันซ้ำ)
DROP POLICY IF EXISTS "trigger_insert_queue" ON public.notification_queue;
DROP POLICY IF EXISTS "staff_queue_select" ON public.notification_queue;

-- อนุญาตให้ trigger/function ใน DB insert ได้ (ถ้าต้องการใช้ trigger สร้าง queue)
CREATE POLICY "trigger_insert_queue" ON public.notification_queue
  FOR INSERT WITH CHECK (true);

-- staff/admin สามารถดู queue เพื่อ debug ได้
CREATE POLICY "staff_queue_select" ON public.notification_queue
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff','admin')
  ));

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_queue_updated_at ON public.notification_queue;
CREATE TRIGGER trg_notif_queue_updated_at
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ==========================================================
-- หมายเหตุ:
--   ตารางนี้แยกจาก system_notifications เพราะ:
--   1. system_notifications = การแจ้งเตือนในระบบ (in-app)
--   2. notification_queue = การส่งออกไปยังช่องทางภายนอก (LINE, Email, ...)
--
--   หากต้องการให้ทั้ง 2 สอดคล้องกัน สามารถเชื่อมด้วย notification_id
--   แต่ในทางปฏิบัติ แยกกันดีกว่าเพื่อให้ queue ทำงานอิสระจาก in-app notif
-- ==========================================================