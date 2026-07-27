-- ==========================================================
-- 010_line_integration.sql — เชื่อมต่อ LINE + ส่งแจ้งเตือนผ่าน LINE
-- ----------------------------------------------------------
-- 1. เพิ่ม line_user_id ใน users (เก็บ LINE userId หลังเชื่อมบัญชี)
-- 2. ตาราง line_link_tokens (LIFF login flow — token ใช้ครั้งเดียว เชื่อมบัญชี)
-- 3. แก้ trigger functions ใน 009 ให้ pg_notify หรือ http_post ส่งข้อความ LINE
--    หมายเหตุ: ส่งจริงผ่าน Next.js API webhook (ความปลอดภัยของ token)
--    trigger แค่ INSERT system_notifications (เหมือนเดิม)
--    แล้ว Next.js ดึงจาก system_notifications ที่ยังไม่ส่ง LINE → ส่ง
-- 4. เพิ่ม line_sent_at ใน system_notifications (track ว่าส่ง LINE แล้ว)
-- ==========================================================

-- ---------- 1. เพิ่ม line_user_id ใน users ----------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS line_user_id VARCHAR(100) UNIQUE;

-- ลบ policy เก่าก่อน (ถ้ามี) แล้วใหม่ — user อัปเดต line_user_id ของตัวเองได้
-- RLS เดิมใน 001 อนุญาต update อยู่แล้ว (ดู trg_protect_user_fields เพื่อดู field lock)

-- ---------- 2. ตาราง line_link_tokens ----------
-- เก็บ token ชั่วคราวสำหรับ flow: LIFF → หน้าเว็บ → เชื่อมบัญชี
-- token ใช้ครั้งเดียว หมดอายุใน 10 นาที
CREATE TABLE IF NOT EXISTS public.line_link_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token        VARCHAR(100) NOT NULL UNIQUE,
  line_user_id VARCHAR(100) NOT NULL,
  line_display_name VARCHAR(200),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_link_tokens_token
  ON public.line_link_tokens(token) WHERE used_at IS NULL;

-- RLS: user ที่ login ในระบบสามารถ claim token ของตัวเอง (อ่านเพื่อใช้)
-- แต่การ insert token เกิดใน LIFF/server action ที่ใช้ service_role
ALTER TABLE public.line_link_tokens ENABLE ROW LEVEL SECURITY;

-- authenticated user สามารถ SELECT token ที่ยังไม่หมดอายุ/ยังไม่ใช้
-- (ใช้ service role ใน action — ข้าม RLS ได้)
CREATE POLICY "auth_select_link_tokens" ON public.line_link_tokens
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_link_tokens" ON public.line_link_tokens
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ---------- 3. เพิ่ม line_sent_at ใน system_notifications ----------
ALTER TABLE public.system_notifications
  ADD COLUMN IF NOT EXISTS line_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sys_notif_pending_line
  ON public.system_notifications(user_id, line_sent_at)
  WHERE line_sent_at IS NULL;

-- ==========================================================
-- หมายเหตุสถาปัตยกรรมการส่ง LINE:
--   ไม่ได้ใช้ pg_net/http ใน trigger เพราะ:
--   1. ต้องการ token ของ LINE Channel Access (ห้ามเก็บใน DB)
--   2. Supabase ฟรีอาจไม่มี pg_net extension
--
--   flow จริง:
--   trigger → INSERT system_notifications (line_sent_at IS NULL)
--   → Next.js route /api/line/dispatch (cron-like, เรียกทุก 1 นาที)
--   → ดึง system_notifications ที่ line_sent_at IS NULL + user มี line_user_id
--   → ส่งข้อความผ่าน LINE Messaging API
--   → UPDATE line_sent_at = now()
--
--   หรือ: ใช้ server action ตอนเกิด event โดยตรง (เช่น ใน borrowAction)
--   → ส่ง LINE ทันที + INSERT system_notifications (line_sent_at = now())
-- ==========================================================