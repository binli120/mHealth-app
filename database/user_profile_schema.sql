-- User Profile Schema
-- Extends the core applicants record with demographic, accessibility,
-- education, bank (encrypted), and notification preference data.
-- One profile per applicant; populated incrementally from user entry or
-- application extraction.

-- ── user_profiles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id  UUID        NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  -- Language, accessibility, education, notification prefs
  profile_data  JSONB       NOT NULL DEFAULT '{}',
  -- AES-256-GCM encrypted bank routing/account numbers + masked last-4
  bank_data     JSONB       NOT NULL DEFAULT '{}',
  -- Supabase Storage path: {userId}/avatar/avatar.{ext}
  -- Legacy rows may hold a full public URL (http://...); new rows use the storage path.
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_id)  -- one profile per applicant
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_applicant_id ON user_profiles(applicant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated ON user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_json ON user_profiles USING GIN (profile_data);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_profile_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Owner (applicant) can read and write their own profile
CREATE POLICY user_profiles_owner_rw
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING  (public.can_access_applicant(applicant_id))
  WITH CHECK (public.can_access_applicant(applicant_id));

-- Staff can access all profiles
CREATE POLICY user_profiles_staff_all
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING  (public.is_staff())
  WITH CHECK (public.is_staff());
