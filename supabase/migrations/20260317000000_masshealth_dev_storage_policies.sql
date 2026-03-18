-- ============================================================
-- Storage bucket policies for "masshealth-dev"
--
-- Applied via: supabase db push  (runs as supabase_storage_admin)
-- NOT via plain psql — postgres user doesn't own storage.objects.
--
-- Folder layout inside the bucket (all under {userId}/ for isolation):
--   {userId}/avatar/avatar.{ext}                     ← profile picture
--   {userId}/{applicationId}/{documentId}/{fileName} ← application docs
--
-- These policies only apply when clients use a user JWT.
-- Server-side code using SUPABASE_SERVICE_ROLE_KEY bypasses them entirely.
-- ============================================================

-- Drop first so this file is safe to re-run
DROP POLICY IF EXISTS "masshealth_dev_upload_own"  ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_read_own"    ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_delete_own"  ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_staff_all"   ON storage.objects;

-- Authenticated users may upload only inside their own {userId}/ folder
CREATE POLICY "masshealth_dev_upload_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may read only their own files
CREATE POLICY "masshealth_dev_read_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may delete only their own files
CREATE POLICY "masshealth_dev_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff (reviewer / admin roles) get full access to the entire bucket
CREATE POLICY "masshealth_dev_staff_all"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND public.is_staff()
  )
  WITH CHECK (
    bucket_id = 'masshealth-dev'
    AND public.is_staff()
  );
