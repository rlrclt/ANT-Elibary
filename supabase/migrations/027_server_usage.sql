-- ==========================================================
-- 027_server_usage.sql — RPC function วัดการใช้งาน DB + Storage
-- ----------------------------------------------------------
-- เป้าหมาย:
--   - ให้หน้า dashboard /staff/server รู้ว่าฐานข้อมูลและ storage
--     ใช้ไปเท่าไหร่ (เป็น byte) เพื่อคำนวณ "ใช้ / เหลือ" เทียบโควตา
--   - Supabase ไม่มี API ให้ดึงขนาด/โควตาโดยตรง
--     จึงใช้ query จากภายใน Postgres เอง (แบบเดียวกับ auto_close_expired_sessions)
--   - SECURITY DEFINER → รันด้วยสิทธิ์ของ postgres ข้าม RLS ได้
--     (อ่าน pg_catalog + storage.objects ได้จาก client ปกติ)
-- ==========================================================

-- ---------- 1. fn_get_database_size() ----------
-- ขนาดรวมของฐานข้อมูลทั้งก้อน (bytes)
CREATE OR REPLACE FUNCTION public.fn_get_database_size()
RETURNS BIGINT
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN pg_database_size(current_database());
END;
$$;

-- ---------- 2. fn_get_table_sizes() ----------
-- ขนาดรายตารางใน schema public (รวม index/toast) + จำนวนแถวโดยประมาณ
-- reltuples = ค่าสถิติจาก ANALYZE (เร็ว ไม่ต้อง COUNT ทั้งตาราง)
CREATE OR REPLACE FUNCTION public.fn_get_table_sizes()
RETURNS TABLE (
  table_name  TEXT,
  size_bytes  BIGINT,
  row_count   BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT AS table_name,
    pg_total_relation_size(('public.' || t.tablename)::regclass)::BIGINT AS size_bytes,
    COALESCE(c.reltuples::BIGINT, 0) AS row_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
  ORDER BY size_bytes DESC;
END;
$$;

-- ---------- 3. fn_get_storage_usage() ----------
-- ขนาดที่ใช้จริงใน storage แยกตาม bucket (bytes + จำนวนไฟล์)
CREATE OR REPLACE FUNCTION public.fn_get_storage_usage()
RETURNS TABLE (
  bucket_name   TEXT,
  bytes         BIGINT,
  object_count  BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.bucket_id::TEXT AS bucket_name,
    COALESCE(SUM((o.metadata->>'size')::BIGINT), 0)::BIGINT AS bytes,
    COUNT(*)::BIGINT AS object_count
  FROM storage.objects o
  GROUP BY o.bucket_id
  ORDER BY bytes DESC;
END;
$$;

-- ---------- 4. ให้สิทธิ์เรียกผ่าน PostgREST ----------
-- default ของ function เปิดให้ PUBLIC เรียกอยู่แล้ว แต่ประกาศชัด
GRANT EXECUTE ON FUNCTION public.fn_get_database_size() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_table_sizes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_storage_usage() TO authenticated, service_role;
