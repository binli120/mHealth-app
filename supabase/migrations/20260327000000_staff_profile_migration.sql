-- Separate staff identity from patients table; update handle_new_auth_user trigger
-- Depends on social_worker_profiles (20260323)
-- @author Bin Lee

BEGIN;

ALTER TABLE public.social_worker_profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS bio        TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_sw_profiles_name
  ON public.social_worker_profiles (last_name, first_name);

UPDATE public.social_worker_profiles swp
SET
  first_name = COALESCE(swp.first_name, ap.first_name),
  last_name  = COALESCE(swp.last_name,  ap.last_name),
  phone      = COALESCE(swp.phone,      ap.phone)
FROM public.applicants ap
WHERE ap.user_id = swp.user_id
  AND (ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL OR ap.phone IS NOT NULL);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  INSERT INTO public.users (id, email, password_hash, is_active, created_at)
  VALUES (NEW.id, NEW.email, 'supabase_auth_managed', true, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, is_active = true;

  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'patient');

  IF v_role NOT IN ('social_worker', 'admin', 'reviewer') THEN
    INSERT INTO public.applicants (user_id, first_name, last_name, phone, created_at)
    VALUES (
      NEW.id,
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'last_name',  ''),
      NULLIF(NEW.raw_user_meta_data->>'phone',       ''),
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (user_id) DO UPDATE
      SET first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
          last_name  = COALESCE(EXCLUDED.last_name,  public.applicants.last_name),
          phone      = COALESCE(EXCLUDED.phone,      public.applicants.phone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

DELETE FROM public.applicants ap
WHERE EXISTS (
  SELECT 1 FROM public.social_worker_profiles swp WHERE swp.user_id = ap.user_id
)
AND NOT EXISTS (
  SELECT 1 FROM public.applications a WHERE a.applicant_id = ap.id
);

COMMIT;
