-- ==========================================================
-- 006_announcements.sql — ระบบประกาศ/ข่าวสาร/แจ้งเตือนระบบ
-- ----------------------------------------------------------
-- ตาราง announcements: ประกาศทั่วไป(notice) / ข่าวสาร(news) / แจ้งเตือนระบบ(alert)
-- ตาราง announcement_reads: ติดตามว่า user อ่านแล้วหรือยัง
-- RLS: ทุกคน SELECT active ได้, staff/admin จัดการได้ทั้งหมด
--      member จัดการ read ของตัวเอง, staff เห็น read ทั้งหมด
-- ==========================================================

-- ตาราง announcements — ประกาศ/ข่าวสาร/แจ้งเตือนระบบ
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'notice' CHECK (type IN ('notice','news','alert')),
  target_audience VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all','member','staff')),
  action_label VARCHAR(50),
  action_url VARCHAR(200),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ตาราง announcement_reads — ติดตามว่า user อ่านแล้วหรือยัง
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX idx_announcements_active ON public.announcements(is_active, created_at DESC);
CREATE INDEX idx_announcements_target ON public.announcements(target_audience);
CREATE INDEX idx_reads_user ON public.announcement_reads(user_id);

-- RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- announcements: ทุกคน SELECT ได้ (เฉพาะ active), staff/admin INSERT/UPDATE/DELETE
CREATE POLICY "anyone_select_active_announcements" ON public.announcements FOR SELECT USING (is_active = true);
CREATE POLICY "staff_all_announcements" ON public.announcements FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff','admin')));

-- reads: member จัดการของตัวเอง, staff เห็นทั้งหมด
CREATE POLICY "member_own_reads" ON public.announcement_reads FOR ALL USING (user_id = auth.uid());
CREATE POLICY "staff_all_reads" ON public.announcement_reads FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff','admin')));