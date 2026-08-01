-- ==========================================================
-- 029_fine_unpaid_flow.sql — flow ค่าปรับใหม่
-- ----------------------------------------------------------
-- สถานะใหม่: unpaid (ออกค่าปรับแล้ว ยังไม่เลือกวิธีชำระ)
--           counter_pending (member แจ้งจะชำระเงินสดที่เคาน์เตอร์)
-- 1. payment_method อนุญาตเป็น NULL (ยังไม่เลือกวิธีชำระตอนออกค่าปรับ)
-- 2. trg_sync_fine_balance หักยอดทั้ง approved และ counter_paid
--    (เดิม counter_paid ไม่หัก = ยอดค้างเกินจริง)
-- ==========================================================

-- ---------- 1. payment_method อนุญาต NULL ----------
ALTER TABLE public.fine_payments
  ALTER COLUMN payment_method DROP NOT NULL;

-- ---------- 2. sync fine_balance คำนวณจาก fine_payments (ยอดค้างจริง) ----------
-- flow ใหม่: ทุกค่าปรับสร้างผ่าน fine_payments → ยอดค้าง = unpaid + counter_pending + pending + rejected
-- (rejected = สลิปไม่ผ่าน ยังเป็นหนี้; approved/counter_paid = ชำระแล้ว ตัดยอด)
-- (เดิมคำนวณจาก borrow_records.fine_amount ลบ approved เท่านั้น — ไม่ครอบ damaged ที่ไม่มี borrow_record)
CREATE OR REPLACE FUNCTION public.trg_sync_fine_balance()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET fine_balance = COALESCE((
    SELECT SUM(amount)
    FROM public.fine_payments
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
      AND status IN ('unpaid', 'counter_pending', 'pending', 'rejected')
  ), 0)
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
