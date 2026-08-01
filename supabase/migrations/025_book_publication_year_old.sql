-- ==========================================================
-- 025_book_publication_year_old.sql — ปีที่พิมพ์ + สถานะหนังสือเก่า
-- ----------------------------------------------------------
-- เป้าหมาย:
--   - เพิ่มคอลัมน์ books.publication_year (ปีที่พิมพ์/ตีพิมพ์) เชื่อมกับเล่มแม่
--   - ขยาย CHECK ของ books.status ให้มี 'old' (หนังสือเก่า)
--   - หนังสือเก่า: ยังเห็นใน admin แต่ซ่อนจาก member + ไม่ให้ยืม
-- ==========================================================

-- ---------- 1. เพิ่มคอลัมน์ปีที่พิมพ์ ----------
-- หนังสือที่ลงทะเบียนไปแล้วก่อน migration นี้ จะมีค่า NULL
-- (ถือว่า "ยังไม่เก่า" จนกว่าจะกรอกปีที่พิมพ์)
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS publication_year INT;

-- index สำหรับกรองหนังสือเก่าเร็วขึ้น (ใช้ร่วมกับสถานะ)
CREATE INDEX IF NOT EXISTS idx_books_publication_year ON public.books(publication_year);

-- ---------- 2. ขยาย CHECK ให้ books.status มี 'old' ----------
ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_status_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_status_check
  CHECK (status IN ('active', 'lost', 'removed', 'old'));
