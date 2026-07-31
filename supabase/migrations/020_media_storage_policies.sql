-- ==========================================================
-- 020_media_storage_policies.sql
-- ==========================================================

-- 1. Ensure the 'media' storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public/authenticated read access to media bucket
DROP POLICY IF EXISTS "public_read_media_storage" ON storage.objects;
CREATE POLICY "public_read_media_storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- 3. Allow all authenticated users to upload (insert) files into 'media' bucket
-- (Members need to upload slips, staff need to upload QR codes)
DROP POLICY IF EXISTS "authenticated_upload_media" ON storage.objects;
CREATE POLICY "authenticated_upload_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

-- 4. Allow only staff/admin to update files in 'media' bucket
DROP POLICY IF EXISTS "staff_update_media" ON storage.objects;
CREATE POLICY "staff_update_media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- 5. Allow only staff/admin to delete files in 'media' bucket
DROP POLICY IF EXISTS "staff_delete_media" ON storage.objects;
CREATE POLICY "staff_delete_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );
