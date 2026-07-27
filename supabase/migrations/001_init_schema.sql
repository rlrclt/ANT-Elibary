-- ==========================================================
-- ระบบ E-Library โรงเรียน — Initial Schema (v2 — Reviewed & Fixed)
-- Supabase / PostgreSQL
-- ----------------------------------------------------------
-- ไฟล์นี้แก้ไขจาก 001_init_schema.sql เดิม โดยแก้บั๊กที่ทำให้
-- สคริปต์รันไม่ผ่าน + ปิดช่องโหว่ RLS ที่ขาดหาย + เพิ่ม index/view
-- เพื่อลดจำนวน query ที่ frontend ต้องยิงซ้ำ
-- ดูรายละเอียดทุกจุดที่แก้ไขใน SCHEMA_REVIEW.md ที่แนบมาด้วย
-- ----------------------------------------------------------
-- สมมติฐานที่ยืนยันแล้วกับผู้ใช้งาน: นักเรียน/ครู/แอดมิน "ทุกคน"
-- มีบัญชี Supabase Auth จริง (สมัคร/ได้รับอีเมลก่อนใช้งาน)
-- ดังนั้น public.users.id ผูกกับ auth.users(id) แบบ 1:1 เสมอ
-- และเพิ่ม trigger บน auth.users ให้สร้างโปรไฟล์อัตโนมัติตอนสมัคร
-- ----------------------------------------------------------
-- วิธีใช้: เปิด Supabase Project → SQL Editor → New Query → วางทั้งไฟล์ → RUN
-- สคริปต์นี้ DROP ตารางเดิมทั้งหมดก่อนสร้างใหม่ (rerun ซ้ำได้ปลอดภัยบน dev/staging)
-- ==========================================================

-- 1. เปิดใช้งาน UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- (ทางเลือกเสริม) ถ้าต้องการค้นหาชื่อผู้แต่ง/ชื่อหนังสือแบบ fuzzy/partial match
-- ให้เปิดใช้ pg_trgm แล้วสร้าง GIN index เพิ่มตามตัวอย่างท้ายไฟล์ (คอมเมนต์ไว้)
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==========================================================
-- 2. DROP TABLE ถ้ามีอยู่ก่อน (เรียงจากลูกก่อน ถึงแม่ — เขียนครบทุกตาราง
--    ให้ชัดเจน แม้ CASCADE จะไล่ลบให้อยู่แล้ว เพื่อกันความสับสนตอนอ่านโค้ด)
-- ==========================================================
DROP TABLE IF EXISTS public.fine_payments    CASCADE;
DROP TABLE IF EXISTS public.room_access_logs CASCADE;
DROP TABLE IF EXISTS public.borrow_records   CASCADE;
DROP TABLE IF EXISTS public.book_copies      CASCADE;
DROP TABLE IF EXISTS public.books            CASCADE;
DROP TABLE IF EXISTS public.book_categories  CASCADE;
DROP TABLE IF EXISTS public.users            CASCADE;

-- ==========================================================
-- 3. ตาราง users (นักเรียน/ครู/แอดมิน)
-- ----------------------------------------------------------
-- แก้ไขจากเดิม:
--   • ลบ DEFAULT auth.uid() ออก — ของเดิมอันตรายมาก เพราะถ้าแอดมินเป็นคน
--     กด INSERT แทนนักเรียน ระบบจะเอา auth.uid() ของ "แอดมิน" ไปใส่แทน
--     กลายเป็นสร้างโปรไฟล์ผิดคน (และแถวที่ 2 จะชนกันทันทีเพราะ PK ซ้ำ)
--     ตอนนี้ id ต้องถูกส่งมาชัดเจนเสมอ (มาจาก auth.uid() ตอนผู้ใช้สมัครเอง
--     หรือมาจาก trigger handle_new_auth_user ด้านล่างที่ผูกกับ auth.users)
--   • เปลี่ยน ON DELETE SET NULL -> ON DELETE CASCADE
--     (ของเดิมพัง เพราะ id เป็น PRIMARY KEY ห้ามเป็น NULL อยู่แล้ว
--     SET NULL บนคอลัมน์ PK จะทำให้ทั้งระบบ error ทันทีที่มีการลบ auth user)
--     เปลี่ยนเป็น CASCADE เพราะยืนยันแล้วว่าทุกคนต้องมีบัญชี auth จริง
--     ถ้าลบบัญชี auth ก็ควรลบโปรไฟล์ห้องสมุดไปด้วย — แต่ประวัติยืม/ค่าปรับ
--     ยังปลอดภัยอยู่ เพราะ borrow_records/fine_payments ตั้งเป็น RESTRICT
--     (ดูหมวด 6, 6.5) ระบบจะ "บล็อกการลบ" ถ้า user คนนั้นยังมีประวัติค้างอยู่
--     บังคับให้ใช้ status='suspended' แทนการลบจริงในทางปฏิบัติ
-- ==========================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_code  VARCHAR(50) NOT NULL UNIQUE,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  department    VARCHAR(100),
  class_level   VARCHAR(50),
  class_number  VARCHAR(20),
  address       TEXT,
  role          VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (role IN ('member', 'staff', 'admin')),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended')),
  borrow_limit  INT NOT NULL DEFAULT 5,
  fine_balance  NUMERIC(10,2) NOT NULL DEFAULT 0,
  phone         VARCHAR(20),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 4. ตาราง book_categories (ประเภทหนังสือ) — ไม่มีการแก้ไข
-- ==========================================================
CREATE TABLE public.book_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL UNIQUE,
  color_code    TEXT DEFAULT '#60a5fa'
);

-- ==========================================================
-- 5. ตาราง books (หนังสือ — เล่มแม่) — ไม่มีการแก้ไขโครงสร้าง
--    (total_copies / available_copies ยังคงเป็นค่าที่ trigger คำนวณให้
--    อัตโนมัติจาก book_copies ทุกครั้งที่มีการเพิ่ม/แก้ไข/ลบเล่มลูก)
-- ==========================================================
CREATE TABLE public.books (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  isbn               TEXT,
  title              TEXT NOT NULL,
  author             TEXT,
  category_id        UUID REFERENCES public.book_categories(id) ON DELETE SET NULL,
  book_code          TEXT NOT NULL UNIQUE,
  total_copies       INT NOT NULL DEFAULT 0 CHECK (total_copies >= 0),
  available_copies   INT NOT NULL DEFAULT 0 CHECK (available_copies >= 0),
  publisher          VARCHAR(150),
  synopsis           TEXT,
  page_count         INT,
  shelf_location     TEXT,
  cover_image_url    TEXT,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'lost', 'removed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_available_le_total CHECK (available_copies <= total_copies)
);
-- หมายเหตุ: total_copies/available_copies DEFAULT เปลี่ยนจาก 1 -> 0 เพราะ
-- ค่าจริงถูกคำนวณจาก book_copies เสมอ (การใส่ 1 มาเป็นค่าตั้งต้นของเดิม
-- ทำให้เข้าใจผิดว่าหนังสือมี 1 เล่มทั้งที่ยังไม่มี book_copies จริง)

-- ==========================================================
-- 5.5 ตาราง book_copies (เล่มลูกของหนังสือ)
-- ----------------------------------------------------------
-- แก้ไข: book_id เปลี่ยนจาก ON DELETE CASCADE -> ON DELETE RESTRICT
--   ของเดิมถ้าลบ books แถวแม่ จะพา book_copies (และไล่ยาวไปถึง
--   borrow_records ทั้งหมดของเล่มนั้น) หายไปด้วย = ประวัติการยืมหาย
--   ทั้งที่โรงเรียนมักต้องเก็บ audit trail ไว้ ใช้ books.status='removed'
--   แทนการลบจริงเสมอ
-- ==========================================================
CREATE TABLE public.book_copies (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id        UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  barcode        VARCHAR(50) NOT NULL UNIQUE,
  status         VARCHAR(20) NOT NULL DEFAULT 'available'
                 CHECK (status IN ('available', 'borrowed', 'lost', 'damaged')),
  condition      VARCHAR(20) NOT NULL DEFAULT 'good'
                 CHECK (condition IN ('new', 'good', 'fair', 'poor')),
  price          NUMERIC(10,2),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 6. ตาราง borrow_records (ประวัติยืม-คืน)
-- ----------------------------------------------------------
-- แก้ไข: user_id และ book_copy_id เปลี่ยนจาก CASCADE -> RESTRICT
--   เหตุผลเดียวกับข้างบน — ป้องกันไม่ให้ลบ user หรือ book_copy ที่มี
--   ประวัติการยืมค้างอยู่ทำให้ audit trail ขาดหาย
-- ==========================================================
CREATE TABLE public.borrow_records (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  book_copy_id   UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE RESTRICT,
  borrowed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date       TIMESTAMPTZ NOT NULL,
  returned_at    TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'borrowing'
                 CHECK (status IN ('borrowing', 'returned', 'overdue', 'lost')),
  fine_amount    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
  fine_reason    VARCHAR(20) CHECK (fine_reason IN ('overdue', 'damaged', 'lost', 'other')),
  remark         TEXT,
  handled_by     UUID REFERENCES public.users(id) ON DELETE SET NULL
);
-- handled_by ยังคงเป็น SET NULL ได้ตามเดิม เพราะเป็นแค่ฟิลด์ระบุตัว "ผู้ทำรายการ"
-- ไม่ใช่ตัวข้อมูลหลักของแถว การเซ็ต NULL ไม่ทำให้ประวัติยืม-คืนเสียหาย

-- ==========================================================
-- 6.5 ตาราง fine_payments (ประวัติการชำระเงินค่าปรับ)
-- ----------------------------------------------------------
-- แก้ไข: borrow_record_id และ user_id เปลี่ยนจาก CASCADE -> RESTRICT
--   (ข้อมูลการเงิน ต้องเก็บ audit trail ไว้เสมอ ห้ามลบหายตามพ่อแม่)
-- ==========================================================
CREATE TABLE public.fine_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrow_record_id UUID NOT NULL REFERENCES public.borrow_records(id) ON DELETE RESTRICT,
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method   VARCHAR(20) NOT NULL DEFAULT 'transfer'
                   CHECK (payment_method IN ('cash', 'transfer')),
  slip_image_url   TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  handled_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  paid_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- 7. ตาราง room_access_logs (สถิติเข้าใช้งานห้องสมุด)
-- ----------------------------------------------------------
-- แก้ไข: user_id เปลี่ยนเป็น NULLABLE + ON DELETE SET NULL (จากเดิม
--   NOT NULL + CASCADE) — ตารางนี้เป็นสถิติ ไม่ใช่ข้อมูลการเงิน/สิทธิ์
--   การลบ user ไม่ควรทำให้ "จำนวนคนเข้าห้องสมุดวันนั้น" หายไปจากรายงาน
--   จึงเก็บแถว log ไว้ (แค่ไม่รู้ว่าเป็นใคร) แทนการลบทั้งแถวหรือบล็อกการลบ
-- ==========================================================
CREATE TABLE public.room_access_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  check_in_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_at   TIMESTAMPTZ,
  purpose        TEXT DEFAULT 'อ่านหนังสือ',
  CONSTRAINT chk_checkout_after_checkin
    CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

-- ==========================================================
-- 8. INDEX — แก้ไข index ที่พังของเดิม + เพิ่ม index ลดการ query ซ้ำซ้อน
-- ==========================================================

-- users
CREATE INDEX idx_users_user_id_code ON public.users(user_id_code);
CREATE INDEX idx_users_role         ON public.users(role);

-- books
CREATE INDEX idx_books_book_code   ON public.books(book_code);
CREATE INDEX idx_books_category    ON public.books(category_id);
CREATE INDEX idx_books_status      ON public.books(status);
CREATE INDEX idx_books_title_gin   ON public.books USING GIN (to_tsvector('simple', title));
-- (ทางเลือกเสริม ถ้าเปิด pg_trgm แล้ว): ค้นหาชื่อผู้แต่งแบบ partial match เร็วขึ้น
-- CREATE INDEX idx_books_author_trgm ON public.books USING GIN (author gin_trgm_ops);

-- book_copies
-- [ใหม่] ของเดิม "ไม่มี index เลย" ทั้งที่ trigger trg_sync_book_counts
-- ยิง SELECT COUNT(*) ... WHERE book_id = ... (AND status='available')
-- ทุกครั้งที่มีการเพิ่ม/แก้ไข/ลบเล่มลูก 1 ตัว — ถ้าคลังหนังสือใหญ่ขึ้น
-- จะ full table scan ทุกครั้ง index นี้ทำให้ query นั้นเร็วขึ้นมาก
CREATE INDEX idx_book_copies_book_status ON public.book_copies(book_id, status);

-- borrow_records
-- [แก้] ของเดิมอ้าง borrow_records(book_id) ซึ่ง "ไม่มีคอลัมน์นี้อยู่จริง"
-- (ตารางมีแค่ book_copy_id) รัน CREATE INDEX เดิมจะ error ทันที แก้เป็น book_copy_id
CREATE INDEX idx_borrow_book_copy   ON public.borrow_records(book_copy_id);
CREATE INDEX idx_borrow_user        ON public.borrow_records(user_id);
CREATE INDEX idx_borrow_status      ON public.borrow_records(status);
-- [ใหม่] query ที่ใช้บ่อยที่สุดของหน้า "ยืมของฉัน/ของ user นี้" คือกรอง
-- user_id + status พร้อมกัน — composite index นี้ครอบคลุมทั้งสองเงื่อนไข
CREATE INDEX idx_borrow_user_status ON public.borrow_records(user_id, status);
-- [แก้] ของเดิมอ้าง (book_id, returned_at) ซึ่งไม่มีคอลัมน์ book_id เช่นกัน
-- แก้เป็น (book_copy_id, returned_at) ใช้เช็คว่าเล่มลูกนี้ถูกยืมอยู่หรือไม่
CREATE INDEX idx_borrow_active      ON public.borrow_records(book_copy_id, returned_at)
  WHERE returned_at IS NULL;
-- [ใหม่] partial index เฉพาะแถวที่ "ยังไม่คืน" ไว้ให้ mark_overdue_books()
-- (รันทุกเที่ยงคืน) และหน้ารายงาน "หนังสือเกินกำหนด" ใช้ scan เฉพาะ
-- แถวที่เกี่ยวข้องแทนการไล่ทั้งตาราง
CREATE INDEX idx_borrow_overdue_check ON public.borrow_records(due_date)
  WHERE status IN ('borrowing', 'overdue') AND returned_at IS NULL;
-- [ใหม่] ใช้กับหน้า "ประวัติที่ฉันเป็นคนทำรายการ" ของเจ้าหน้าที่
CREATE INDEX idx_borrow_handled_by  ON public.borrow_records(handled_by)
  WHERE handled_by IS NOT NULL;

-- fine_payments
-- [ใหม่] trg_sync_fine_balance ยิง SELECT SUM(amount) ... WHERE user_id = ...
-- AND status='approved' ทุกครั้งที่มีการเพิ่ม/แก้ไขค่าปรับ — index นี้จำเป็นมาก
CREATE INDEX idx_fine_payments_user_status ON public.fine_payments(user_id, status);
CREATE INDEX idx_fine_payments_borrow      ON public.fine_payments(borrow_record_id);

-- room_access_logs
CREATE INDEX idx_access_user        ON public.room_access_logs(user_id);
CREATE INDEX idx_access_checkin     ON public.room_access_logs(check_in_at);
CREATE INDEX idx_access_active      ON public.room_access_logs(user_id, check_out_at)
  WHERE check_out_at IS NULL;
-- [ใหม่] expression index รองรับ query แบบ "GROUP BY DATE(check_in_at)"
-- ที่ใช้ในหน้า Dashboard สถิติรายวัน/รายเดือน ไม่ต้อง scan ทั้งตาราง
CREATE INDEX idx_access_checkin_date ON public.room_access_logs (((check_in_at AT TIME ZONE 'Asia/Bangkok')::date));

-- ==========================================================
-- 9. Helper Function — is_admin() คืน TRUE ถ้า user ปัจจุบันเป็น admin
--    (ไม่มีการแก้ไข — เขียนถูกต้องแล้ว ใช้ SECURITY DEFINER เพื่อเลี่ยง
--    ปัญหา RLS recursion ตอน policy ของ users ต้อง query ตาราง users เอง)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==========================================================
-- 9.5 [ใหม่] Generic updated_at trigger — ของเดิมมีคอลัมน์ updated_at
--     ใน book_copies และ fine_payments แต่ไม่มี trigger ใดอัปเดตให้เลย
--     ค่าจะค้างเป็นเวลาตอนสร้างแถวตลอดไป ทั้งที่ตั้งใจให้ track การแก้ไขล่าสุด
-- ==========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================
-- 10. Trigger Functions — Logic ป้องกัน/อัตโนมัติ
-- ==========================================================

-- 10.1 เมื่อ INSERT/UPDATE/DELETE book_copies -> sync total/available copies ใน books
--      (ไม่มีการแก้ไข logic เดิม)
CREATE OR REPLACE FUNCTION public.trg_sync_book_counts()
RETURNS trigger AS $$
DECLARE
  v_book_id UUID;
BEGIN
  v_book_id := COALESCE(NEW.book_id, OLD.book_id);
  UPDATE public.books
  SET total_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = v_book_id),
      available_copies = (SELECT COUNT(*) FROM public.book_copies WHERE book_id = v_book_id AND status = 'available')
  WHERE id = v_book_id;
  RETURN NULL; -- statement นี้เป็น AFTER trigger ไม่ต้อง return NEW/OLD จริงจัง
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.2 เมื่อยืม/คืน/แจ้งสูญหาย (borrow_records) -> sync สถานะ book_copies อัตโนมัติ
-- [แก้ไข] ของเดิมไม่มี logic รองรับตอน status ถูกเปลี่ยนเป็น 'lost'
--   ทำให้เล่มที่แจ้งสูญหายค้างสถานะ 'borrowed' ตลอดไป ไม่มีวันกลับมา
--   นับใน available_copies ได้อีก แต่ก็ไม่ถูกทำเครื่องหมายว่าสูญหายจริง
--   เพิ่มเงื่อนไขใหม่ให้ sync ไปเป็น status='lost' ใน book_copies ด้วย
CREATE OR REPLACE FUNCTION public.trg_borrow_update_copy_status()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'borrowing' THEN
    UPDATE public.book_copies
       SET status = 'borrowed', updated_at = now()
     WHERE id = NEW.book_copy_id AND status = 'available';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'หนังสือเล่มนี้ (book_copy_id: %) ไม่พร้อมให้ยืม (อาจถูกยืมไปแล้วหรือสูญหาย)', NEW.book_copy_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- คืนสำเร็จ (และไม่ใช่กรณีสูญหาย) -> เล่มกลับมา available
    IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL AND NEW.status <> 'lost' THEN
      UPDATE public.book_copies
         SET status = 'available', updated_at = now()
       WHERE id = NEW.book_copy_id;
    END IF;

    -- [ใหม่] แจ้งหนังสือสูญหาย -> เล่มลูกออกจากระบบยืมถาวร
    IF NEW.status = 'lost' AND OLD.status IS DISTINCT FROM 'lost' THEN
      UPDATE public.book_copies
         SET status = 'lost', updated_at = now()
       WHERE id = NEW.book_copy_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.3 Cron-ish — Auto เปลี่ยนสถานะเป็น overdue (ไม่มีการแก้ไข logic เดิม)
CREATE OR REPLACE FUNCTION public.mark_overdue_books()
RETURNS void AS $$
BEGIN
  UPDATE public.borrow_records
     SET status = 'overdue'
   WHERE status = 'borrowing'
     AND returned_at IS NULL
     AND due_date < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.3.5 [ใหม่] Cron-ish — Auto check-out คนที่ลืมเช็คเอาท์ตอนปิดห้องสมุด
--        (เอกสารออกแบบพูดถึง AUTO_CHECKOUT_HOUR ไว้ แต่ของเดิมไม่มีฟังก์ชันนี้เลย)
CREATE OR REPLACE FUNCTION public.mark_auto_checkout()
RETURNS void AS $$
BEGIN
  UPDATE public.room_access_logs
     SET check_out_at = now()
   WHERE check_out_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.4 ป้องกัน User แก้ไขสิทธิ์/โควต้า/ยอดค้างชำระของตัวเอง (ไม่มีการแก้ไข logic เดิม)
CREATE OR REPLACE FUNCTION public.trg_protect_user_fields()
RETURNS trigger AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() = NEW.id THEN
    NEW.role := OLD.role;
    NEW.fine_balance := OLD.fine_balance;
    NEW.borrow_limit := OLD.borrow_limit;
    NEW.status := OLD.status;
    NEW.user_id_code := OLD.user_id_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.5 Sync fine_balance อัตโนมัติ (ไม่มีการแก้ไข logic เดิม)
CREATE OR REPLACE FUNCTION public.trg_sync_fine_balance()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET fine_balance = (
    SELECT COALESCE(SUM(fine_amount), 0)
    FROM public.borrow_records
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  ) - (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.fine_payments
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
      AND status = 'approved'
  )
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.6 [ใหม่] สร้างโปรไฟล์ public.users อัตโนมัติเมื่อมีคนสมัคร Supabase Auth
-- ----------------------------------------------------------
-- เนื่องจากยืนยันแล้วว่า "ทุกคนมีบัญชี auth จริง" ระบบควรผูก 2 ตารางนี้
-- ให้เชื่อมกันอัตโนมัติ แทนที่จะพึ่ง frontend เรียก insert เองทุกครั้ง
-- (ถ้า frontend ลืม insert = auth มีบัญชีแต่ไม่มีโปรไฟล์ ใช้งานไม่ได้)
--
-- แอปฝั่ง client ต้องส่ง metadata ตอนสมัคร เช่น:
--   supabase.auth.signUp({ email, password, options: { data: {
--     full_name: 'ด.ช. ทดสอบ ระบบ', phone: '0812345678'
--   }}})
-- role สมัครจากหน้าเว็บจะเป็น 'member' เสมอ (default ในตาราง)
-- user_id_code ถ้าไม่ส่ง ระบบจะ auto-generate จาก UUID ให้อัตโนมัติ
-- ==========================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
  v_user_id_code VARCHAR(50);
BEGIN
  -- ถ้าส่ง user_id_code มาใช้ค่านั้น, ถ้าไม่ส่ง generate จาก UUID (ไม่รวม hyphen)
  v_user_id_code := NEW.raw_user_meta_data ->> 'user_id_code';
  IF v_user_id_code IS NULL THEN
    v_user_id_code := 'AUTO-' || UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 8));
  END IF;

  INSERT INTO public.users (id, user_id_code, full_name, email, phone, role)
  VALUES (
    NEW.id,
    v_user_id_code,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'ไม่ระบุชื่อ'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================
-- 11. ติดตั้ง Trigger บนตาราง
-- ==========================================================
DROP TRIGGER IF EXISTS trg_after_borrow_insert ON public.borrow_records;
CREATE TRIGGER trg_after_borrow_insert
  AFTER INSERT ON public.borrow_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_borrow_update_copy_status();

DROP TRIGGER IF EXISTS trg_after_borrow_update ON public.borrow_records;
CREATE TRIGGER trg_after_borrow_update
  AFTER UPDATE ON public.borrow_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_borrow_update_copy_status();

DROP TRIGGER IF EXISTS trg_sync_book_copies ON public.book_copies;
CREATE TRIGGER trg_sync_book_copies
  AFTER INSERT OR UPDATE OR DELETE ON public.book_copies
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_book_counts();

DROP TRIGGER IF EXISTS trg_before_users_update ON public.users;
CREATE TRIGGER trg_before_users_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_protect_user_fields();

DROP TRIGGER IF EXISTS trg_sync_fine_insert_update ON public.borrow_records;
CREATE TRIGGER trg_sync_fine_insert_update
  AFTER INSERT OR UPDATE OF fine_amount ON public.borrow_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_fine_balance();

DROP TRIGGER IF EXISTS trg_sync_fine_delete ON public.borrow_records;
CREATE TRIGGER trg_sync_fine_delete
  AFTER DELETE ON public.borrow_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_fine_balance();

DROP TRIGGER IF EXISTS trg_sync_fine_payment ON public.fine_payments;
CREATE TRIGGER trg_sync_fine_payment
  AFTER INSERT OR UPDATE OF amount, status OR DELETE ON public.fine_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_fine_balance();

-- [ใหม่] updated_at auto-touch
DROP TRIGGER IF EXISTS trg_book_copies_updated_at ON public.book_copies;
CREATE TRIGGER trg_book_copies_updated_at
  BEFORE UPDATE ON public.book_copies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fine_payments_updated_at ON public.fine_payments;
CREATE TRIGGER trg_fine_payments_updated_at
  BEFORE UPDATE ON public.fine_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- [ใหม่] auto-provision โปรไฟล์ตอนสมัคร Supabase Auth
DROP TRIGGER IF EXISTS trg_handle_new_auth_user ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==========================================================
-- 12. เปิดใช้งาน Row Level Security (RLS) ทุกตาราง
-- [แก้ไข] ของเดิม "ลืมเปิด RLS" ให้ book_copies และ fine_payments
--   ทั้งสองตารางนี้จึงเปิดโล่งให้ใครก็ได้ที่มี anon/authenticated key
--   อ่าน-เขียนได้ตามสิทธิ์ default ของ Postgres role (ไม่ถูกจำกัดเลย)
--   fine_payments มี slip_image_url และยอดเงินคนอื่นอยู่ด้วย ถือเป็น
--   ช่องโหว่ข้อมูลรั่วที่ต้องปิดด่วนที่สุดในรายการทั้งหมด
-- ==========================================================
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_copies       ENABLE ROW LEVEL SECURITY;   -- [ใหม่]
ALTER TABLE public.borrow_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fine_payments     ENABLE ROW LEVEL SECURITY;   -- [ใหม่]
ALTER TABLE public.room_access_logs  ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 13. Policy
-- ==========================================================

-- ===========================
-- book_categories (ไม่มีการแก้ไข)
-- ===========================
CREATE POLICY "categories_select_public"
  ON public.book_categories FOR SELECT
  USING (true);

CREATE POLICY "categories_modify_admin_only"
  ON public.book_categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===========================
-- books (ไม่มีการแก้ไข)
-- ===========================
CREATE POLICY "books_select_public"
  ON public.books FOR SELECT
  USING (true);

CREATE POLICY "books_modify_admin_only"
  ON public.books FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===========================
-- [ใหม่] book_copies — ให้สิทธิ์แบบเดียวกับ books เพื่อให้หน้าเว็บ
--   query "เล่มไหนว่าง อยู่ชั้นไหน" ได้แบบ public โดยไม่ต้อง login
--   (ถ้าไม่อยากเปิด barcode/price ให้สาธารณะเห็น แนะนำสร้าง VIEW
--   กรองเฉพาะคอลัมน์ที่ต้องการแล้ว grant select ที่ view แทน)
-- ===========================
CREATE POLICY "book_copies_select_public"
  ON public.book_copies FOR SELECT
  USING (true);

CREATE POLICY "book_copies_modify_admin_only"
  ON public.book_copies FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===========================
-- users (ไม่มีการแก้ไข logic เดิม)
-- ===========================
CREATE POLICY "users_read_self_or_admin"
  ON public.users FOR SELECT
  USING (
    (auth.uid() = id)
    OR public.is_admin()
  );

CREATE POLICY "users_write_admin_only"
  ON public.users FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "users_update_admin_or_self"
  ON public.users FOR UPDATE
  USING (
    (auth.uid() = id)
    OR public.is_admin()
  );

CREATE POLICY "users_delete_admin_only"
  ON public.users FOR DELETE
  USING (public.is_admin());

-- ===========================
-- borrow_records (ไม่มีการแก้ไข — เขียนผ่าน service_role, อ่านได้ owner/admin)
-- ===========================
CREATE POLICY "borrow_read_owner_or_admin"
  ON public.borrow_records FOR SELECT
  USING (
    (auth.uid() = user_id)
    OR public.is_admin()
  );

-- ===========================
-- [ใหม่] fine_payments — เปิดให้เจ้าของแนบสลิปโอนเงินได้เอง (self-service)
--   แต่การอนุมัติ/ปฏิเสธ (UPDATE status) ทำได้เฉพาะ admin เท่านั้น
--   ไม่เปิด DELETE policy ใดๆ เลย = ห้ามลบประวัติการจ่ายเงินผ่าน API
--   (ต้องผ่าน service_role เท่านั้นถ้าจำเป็นจริงๆ เพื่อรักษา audit trail)
-- ===========================
CREATE POLICY "fine_payments_select_owner_or_admin"
  ON public.fine_payments FOR SELECT
  USING (
    (auth.uid() = user_id)
    OR public.is_admin()
  );

CREATE POLICY "fine_payments_insert_owner_or_admin"
  ON public.fine_payments FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id)
    OR public.is_admin()
  );

CREATE POLICY "fine_payments_update_admin_only"
  ON public.fine_payments FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===========================
-- room_access_logs (ไม่มีการแก้ไข)
-- ===========================
CREATE POLICY "access_logs_anon_can_insert"
  ON public.room_access_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "access_logs_read_self_or_admin"
  ON public.room_access_logs FOR SELECT
  USING (
    (auth.uid() = user_id)
    OR public.is_admin()
  );

CREATE POLICY "access_logs_update_admin_only"
  ON public.room_access_logs FOR UPDATE
  USING (public.is_admin());

-- ==========================================================
-- 14. [ใหม่] Views + Dashboard Function — ลดจำนวน query ที่ frontend
--     ต้องยิงซ้ำหลายรอบ ให้เหลือ query เดียวต่อหน้าจอ
-- ==========================================================

-- 14.1 รายการที่ "กำลังถูกยืมอยู่" พร้อม join ข้อมูลที่ต้องโชว์ครบในคำสั่งเดียว
--      (แทนที่ frontend จะต้อง query borrow_records แล้วค่อยไป query
--      book_copies, books, users ทีละตารางแยกกัน)
CREATE OR REPLACE VIEW public.v_active_borrows AS
SELECT
  br.id            AS borrow_record_id,
  br.user_id,
  u.full_name,
  u.user_id_code,
  bc.id            AS book_copy_id,
  bc.barcode,
  b.id             AS book_id,
  b.title,
  b.author,
  br.borrowed_at,
  br.due_date,
  br.status,
  (br.due_date < now()) AS is_overdue
FROM public.borrow_records br
JOIN public.book_copies bc ON bc.id = br.book_copy_id
JOIN public.books b        ON b.id = bc.book_id
JOIN public.users u        ON u.id = br.user_id
WHERE br.returned_at IS NULL;

-- 14.2 กรองต่อเฉพาะที่เกินกำหนดจริง — ใช้ตรงกับหน้า "แจ้งเตือน/เก็บค่าปรับ"
CREATE OR REPLACE VIEW public.v_overdue_borrows AS
SELECT * FROM public.v_active_borrows WHERE is_overdue;

-- 14.3 คนที่ "อยู่ในห้องสมุดตอนนี้" — ใช้กับ Dashboard และหน้า checkin
CREATE OR REPLACE VIEW public.v_currently_in_room AS
SELECT
  ral.id      AS access_log_id,
  ral.user_id,
  u.full_name,
  u.user_id_code,
  ral.check_in_at,
  ral.purpose
FROM public.room_access_logs ral
LEFT JOIN public.users u ON u.id = ral.user_id
WHERE ral.check_out_at IS NULL;

-- 14.4 หนังสือยอดนิยม — ใช้กับ Dashboard (คำนวณจาก borrow_records ทั้งหมด)
CREATE OR REPLACE VIEW public.v_popular_books AS
SELECT
  b.id AS book_id,
  b.title,
  b.author,
  COUNT(br.id) AS borrow_count
FROM public.books b
JOIN public.book_copies bc  ON bc.book_id = b.id
JOIN public.borrow_records br ON br.book_copy_id = bc.id
GROUP BY b.id, b.title, b.author
ORDER BY borrow_count DESC;

-- 14.5 สรุปสถิติหน้า Dashboard ในคำสั่งเดียว — เดิม frontend ต้องยิง
--      4 query แยกกัน (คนในห้อง / ยืมวันนี้ / เกินกำหนด / ค่าปรับค้าง)
--      ฟังก์ชันนี้รวมเป็น 1 round-trip เดียว จำกัดสิทธิ์เฉพาะ admin
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
  people_in_room     BIGINT,
  borrowed_today      BIGINT,
  overdue_count        BIGINT,
  unpaid_fine_total   NUMERIC
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'permission denied: เฉพาะ admin เท่านั้น';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.room_access_logs WHERE check_out_at IS NULL),
    (SELECT COUNT(*) FROM public.borrow_records WHERE borrowed_at::date = CURRENT_DATE),
    (SELECT COUNT(*) FROM public.borrow_records
       WHERE status IN ('borrowing', 'overdue') AND returned_at IS NULL AND due_date < now()),
    (SELECT COALESCE(SUM(fine_balance), 0) FROM public.users WHERE fine_balance > 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- หมายเหตุ: view ทั้ง 4 ตัวด้านบน "ไม่ได้" bypass RLS — เวลา query จะยึดสิทธิ์
-- ของตารางต้นทางตามปกติ (สมาชิกทั่วไป query v_active_borrows จะเห็นแค่แถว
-- ของตัวเอง เพราะ borrow_records policy จำกัดไว้อยู่แล้ว ส่วน admin เห็นครบ)

-- ==========================================================
-- 15. Seed Data ตัวอย่าง (สำหรับทดสอบระบบ)
-- ==========================================================

-- 15.1 ประเภทหนังสือ
INSERT INTO public.book_categories (id, name, color_code) VALUES
  ('00000000-0000-0000-0000-000000000001', 'หนังสือเรียน', '#3b82f6'),
  ('00000000-0000-0000-0000-000000000002', 'นวนิยาย',   '#ec4899'),
  ('00000000-0000-0000-0000-000000000003', 'สารคดี',     '#10b981')
ON CONFLICT DO NOTHING;

-- 15.2 หนังสือตัวอย่าง
-- [แก้ไข] ไม่ใส่ total_copies/available_copies ตรงๆ อีกต่อไป เพราะค่าจริง
--   จะถูกคำนวณให้อัตโนมัติทันทีที่ seed ข้อมูล book_copies ด้านล่าง (15.3)
--   ของเดิม hardcode ตัวเลขไว้ทั้งที่ "ไม่เคยสร้าง book_copies จริงเลยสักแถว"
--   ทำให้ตัวเลขในคอลัมน์นี้เป็นค่าลอยๆ ไม่ตรงกับข้อมูลจริงในระบบ
INSERT INTO public.books (title, author, category_id, book_code, shelf_location, status) VALUES
  ('คณิตศาสตร์ ม.4 เล่ม 1', 'อ.สมศักดิ์ มั่นคง',      '00000000-0000-0000-0000-000000000001', 'BK-M4-001', 'ชั้น A-1', 'active'),
  ('ฟิสิกส์ ม.4 เล่ม 1',   'อ.วิเชียร สุขสวัสดิ์',    '00000000-0000-0000-0000-000000000001', 'BK-M4-002', 'ชั้น A-2', 'active'),
  ('ภาษาอังกฤษ ม.5',        'ครูทิพย์ วรรณดำรง',     '00000000-0000-0000-0000-000000000001', 'BK-M5-003', 'ชั้น A-3', 'active'),
  ('สี่แยกผี',               'ปัญญา ประสมชาย',        '00000000-0000-0000-0000-000000000002', 'BK-NV-001', 'ชั้น B-1', 'active'),
  ('คินเน่',                 'สมชาย สวัสดิ์รักษ์',     '00000000-0000-0000-0000-000000000002', 'BK-NV-002', 'ชั้น B-1', 'active'),
  ('ประวัติศาสตร์ไทยตอนต้น',  'มหาวิทยาลัยเชียงใหม่',   '00000000-0000-0000-0000-000000000003', 'BK-DK-001', 'ชั้น C-1', 'active'),
  ('โลกธรรมชาติ',            'กรมอุทยานแห่งชาติ',       '00000000-0000-0000-0000-000000000003', 'BK-DK-002', 'ชั้น C-2', 'active')
ON CONFLICT DO NOTHING;

-- 15.3 [ใหม่] สร้าง book_copies จริงให้แต่ละเล่ม — จำนวนเท่ากับ
--      total_copies เดิมที่เคย hardcode ไว้ (3,2,2,4,2,1,2) แต่คราวนี้
--      เป็นแถวจริง ทำให้ trigger คำนวณ total/available_copies ถูกต้อง
--      อัตโนมัติทันทีที่ INSERT เสร็จ (ไม่ต้องไป UPDATE books ซ้ำเอง)
INSERT INTO public.book_copies (book_id, barcode)
SELECT b.id, b.book_code || '-C' || gs
FROM public.books b
CROSS JOIN LATERAL generate_series(1, CASE b.book_code
  WHEN 'BK-M4-001' THEN 3
  WHEN 'BK-M4-002' THEN 2
  WHEN 'BK-M5-003' THEN 2
  WHEN 'BK-NV-001' THEN 4
  WHEN 'BK-NV-002' THEN 2
  WHEN 'BK-DK-001' THEN 1
  WHEN 'BK-DK-002' THEN 2
  ELSE 1
END) AS gs
ON CONFLICT (barcode) DO NOTHING;

-- 15.4 ผู้ใช้ตัวอย่าง (นักเรียน + เจ้าหน้าที่)
-- ----------------------------------------------------------
-- ⚠️ สำคัญมาก: ตอนนี้ users.id ผูก FK กับ auth.users(id) แบบบังคับจริง
-- (ตามที่ยืนยันว่าทุกคนต้องมีบัญชี auth) ดังนั้น UUID สมมติด้านล่างนี้
-- จะ INSERT ไม่ผ่านถ้า auth.users ไม่มีแถวที่ id ตรงกันอยู่จริง
--
-- สำหรับ "ข้อมูลทดสอบใน dev/local เท่านั้น" ใช้เทคนิคปิด FK/trigger
-- ชั่วคราวด้านล่าง — ❌ ห้ามรันคำสั่งนี้ใน production เด็ดขาด
-- สำหรับ production/staging จริง ให้สร้างบัญชีผ่าน Supabase Auth ก่อน
-- (Dashboard → Authentication → Add user หรือ supabase.auth.admin.createUser)
-- แล้ว trigger trg_handle_new_auth_user (หมวด 10.6) จะสร้างโปรไฟล์ให้เอง
-- โดยไม่ต้องรันส่วนนี้เลย
-- ----------------------------------------------------------
SET session_replication_role = replica;

INSERT INTO public.users (id, user_id_code, full_name, role, department, phone) VALUES
  ('11111111-1111-1111-1111-111111111111', '65001', 'นายสมชาย ใจดี',           'member', 'ช่างยนต์', '081-111-1111'),
  ('11111111-1111-1111-1111-111111111112', '65002', 'นางสาวมินตรา  สุขสวัสดิ์', 'member', 'บัญชี',    '081-222-2222'),
  ('11111111-1111-1111-1111-111111111113', 'T001',  'ครูอาร์ม  ครูห้องสมุด',    'admin',  'ห้องสมุด', '081-333-3333'),
  ('11111111-1111-1111-1111-111111111114', '65003', 'นายเดชา  สามัคคี',        'member', 'ช่างกล',   '081-444-4444')
ON CONFLICT DO NOTHING;

SET session_replication_role = DEFAULT;

-- ==========================================================
-- 16. (Optional) pg_cron — งานที่ต้องรันอัตโนมัติทุกวัน
--    เปิดใช้งาน pg_cron extension ก่อน → Supabase UI → Database → Extensions
-- ==========================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.schedule(
--   'mark-overdue-nightly',
--   '0 0 * * *',                                    -- เที่ยงคืนทุกวัน
--   $$ SELECT public.mark_overdue_books(); $$
-- );
--
-- -- [ใหม่] auto checkout ตอนปิดห้องสมุด (อ้างอิง AUTO_CHECKOUT_HOUR = 17:00
-- -- ใน config/app.config.ts ของฝั่ง frontend — ปรับเวลาให้ตรงกันด้วย)
-- SELECT cron.schedule(
--   'auto-checkout-library-close',
--   '0 17 * * *',                                   -- 17:00 ทุกวัน
--   $$ SELECT public.mark_auto_checkout(); $$
-- );

-- ==========================================================
-- จบ Script
-- ==========================================================