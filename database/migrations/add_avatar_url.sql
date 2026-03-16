-- Migration: add avatar_url column to user_profiles
-- Run once against the target database.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

COMMENT ON COLUMN user_profiles.avatar_url IS
  'Full public URL of the user''s profile picture stored in Supabase Storage bucket "profile-avatars".
   Path format: {user_id}/avatar.{ext}?v={timestamp}
   NULL means no avatar has been uploaded.';

-- ── Supabase Storage bucket setup ─────────────────────────────────────────────
-- Run these in the Supabase dashboard → Storage → New bucket, OR via the CLI:
--
--   supabase storage create-bucket profile-avatars --public
--
-- Then add the following RLS policies on the bucket objects:
--
-- INSERT (authenticated users can upload their own avatar):
--   ((storage.foldername(name))[1] = auth.uid()::text)
--
-- UPDATE / DELETE (authenticated users can manage their own avatar):
--   ((storage.foldername(name))[1] = auth.uid()::text)
--
-- SELECT (public reads — avatar URLs are intentionally shareable):
--   true
