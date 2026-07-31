-- ==========================================================
-- 012_storage_users_profile.sql — Storage bucket สำหรับรูปโปรไฟล์
-- ----------------------------------------------------------
-- สร้าง bucket "users-profile" สำหรับเก็บรูปโปรไฟล์ผู้ใช้
-- รองรับ: image/jpeg, image/png, image/webp, image/gif
-- จำกัดขนาด: 3MB
--
-- RLS policies:
--   - user อัปโหลดได้เฉพาะโฟลเดอร์ของตัวเอง (users/{user_id}/...)
--   - อ่านได้ทุกคน (public read — รูปโปรไฟล์ต้องแสดงในหน้าเว็บ)
-- ==========================================================

-- ---------- สร้าง bucket ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('users-profile', 'users-profile', true)
ON CONFLICT (id) DO NOTHING;

-- ---------- RLS policies ----------
-- อ่านได้ทุกคน (public bucket)
CREATE POLICY "public_read_users_profile"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'users-profile');

-- อัปโหลด: user ต้อง login และไฟล์ต้องอยู่ในโฟลเดอร์ของตัวเอง
-- path pattern: users/{user_id}/filename
-- ใช้ string_to_array เพื่อแยก path แล้วเช็คโฟลเดอร์ที่ 1 = 'users' และที่ 2 = user_id
CREATE POLICY "user_upload_own_profile"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'users-profile'
    AND (string_to_array(name, '/'))[1] = 'users'
    AND (string_to_array(name, '/'))[2] = auth.uid()::text
  );

-- อัปเดต: user ต้องเป็นเจ้าของไฟล์
CREATE POLICY "user_update_own_profile"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'users-profile'
    AND (string_to_array(name, '/'))[1] = 'users'
    AND (string_to_array(name, '/'))[2] = auth.uid()::text
  );

-- ลบ: user ต้องเป็นเจ้าของไฟล์
CREATE POLICY "user_delete_own_profile"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'users-profile'
    AND (string_to_array(name, '/'))[1] = 'users'
    AND (string_to_array(name, '/'))[2] = auth.uid()::text
  );

-- ==========================================================
-- หมายเหตุ:
--   - ใช้ path pattern: users/{user_id}/profile-{timestamp}.ext
--   - MIME type และ size limit ตรวจใน server action (ไม่ได้ทำใน DB)
--   - bucket เป็น public เพื่อให้แสดงรูปในหน้าเว็บได้โดยตรง
--   - ใช้ string_to_array แทน storage.foldername เพื่อความชัวร์
-- ==========================================================