-- Add avatar_url to user_profiles (idempotent — column may already exist from 20260326)
-- @author Bin Lee

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.avatar_url IS
  'Full public URL of the user''s profile picture stored in Supabase Storage bucket "profile-avatars".
   Path format: {user_id}/avatar.{ext}?v={timestamp}. NULL means no avatar uploaded.';
