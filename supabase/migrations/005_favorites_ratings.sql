-- ==========================================================
-- Migration 005 — ระบบรายการโปรด (favorites) + ให้ดาวหนังสือ (ratings)
-- ----------------------------------------------------------
-- ตาราง:
--   • book_favorites — รายการโปรดของสมาชิก (bookmark/heart)
--   • book_ratings   — ให้คะแนนดาว 1-5 พร้อมรีวิว (UPSERT ต่อ user+book)
-- RLS:
--   • member จัดการได้เฉพาะของตัวเอง (user_id = auth.uid())
--   • staff/admin เห็นและจัดการได้ทั้งหมด
-- ==========================================================

-- ตาราง book_favorites (รายการโปรด)
CREATE TABLE IF NOT EXISTS public.book_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);

-- ตาราง book_ratings (ให้ดาว 1-5)
CREATE TABLE IF NOT EXISTS public.book_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.book_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_book ON public.book_favorites(book_id);
CREATE INDEX IF NOT EXISTS idx_ratings_book ON public.book_ratings(book_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON public.book_ratings(user_id);

-- เปิด RLS
ALTER TABLE public.book_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_ratings ENABLE ROW LEVEL SECURITY;

-- favorites: member จัดการของตัวเอง, staff เห็นทั้งหมด
CREATE POLICY "member_all_own_favorites"
  ON public.book_favorites FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "staff_all_favorites"
  ON public.book_favorites FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff', 'admin')
  ));

-- ratings: member จัดการของตัวเอง, staff เห็นทั้งหมด
CREATE POLICY "member_all_own_ratings"
  ON public.book_ratings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "staff_all_ratings"
  ON public.book_ratings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff', 'admin')
  ));

-- ==========================================================
-- จบ Migration 005
-- ==========================================================