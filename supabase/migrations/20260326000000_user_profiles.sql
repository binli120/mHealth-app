-- User Profiles table — depends on applicants (20260301)
-- @author Bin Lee

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  profile_data JSONB       NOT NULL DEFAULT '{}',
  bank_data    JSONB       NOT NULL DEFAULT '{}',
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_applicant_id ON public.user_profiles(applicant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated      ON public.user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_json         ON public.user_profiles USING GIN (profile_data);

CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_user_profile_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_owner_rw ON public.user_profiles;
CREATE POLICY user_profiles_owner_rw ON public.user_profiles FOR ALL TO authenticated
  USING  (public.can_access_applicant(applicant_id))
  WITH CHECK (public.can_access_applicant(applicant_id));
DROP POLICY IF EXISTS user_profiles_staff_all ON public.user_profiles;
CREATE POLICY user_profiles_staff_all ON public.user_profiles FOR ALL TO authenticated
  USING  (public.is_staff()) WITH CHECK (public.is_staff());
