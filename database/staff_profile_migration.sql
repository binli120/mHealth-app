/**
 * Migration: Separate staff identity data from the patients (applicants) table.
 *
 * Problem: handle_new_auth_user() was inserting ALL new auth users into
 * public.applicants, including social workers and other staff whose personal
 * info has no business being in the patient table.  Every query that needed a
 * SW's name had to JOIN applicants — wrong table, wrong semantics.
 *
 * Solution:
 *   1. Add first_name / last_name / phone / bio / avatar_url to
 *      social_worker_profiles (the canonical home for SW identity).
 *   2. Back-fill those columns from the orphaned applicants rows.
 *   3. Replace the trigger so it only touches applicants for patient accounts.
 *   4. Delete the orphaned applicants rows for social workers (no applications
 *      attached) — patients are left untouched.
 *
 * Run order: after mHealth_schema.sql + social_worker_schema.sql
 * @author Bin Lee
 */

BEGIN;

-- ── 1. Add identity columns to social_worker_profiles ──────────────────────

ALTER TABLE public.social_worker_profiles
  ADD COLUMN IF NOT EXISTS first_name  TEXT,
  ADD COLUMN IF NOT EXISTS last_name   TEXT,
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS bio         TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url  TEXT;

CREATE INDEX IF NOT EXISTS idx_sw_profiles_name
  ON public.social_worker_profiles (last_name, first_name);

-- ── 2. Back-fill names from applicants for existing social workers ──────────

UPDATE public.social_worker_profiles swp
SET
  first_name = COALESCE(swp.first_name, ap.first_name),
  last_name  = COALESCE(swp.last_name,  ap.last_name),
  phone      = COALESCE(swp.phone,      ap.phone)
FROM public.applicants ap
WHERE ap.user_id = swp.user_id
  AND (ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL OR ap.phone IS NOT NULL);

-- ── 3. Replace trigger — skip applicants insert for staff roles ─────────────
--
-- The registration page now passes role = 'social_worker' in user metadata.
-- Admin / reviewer accounts created via invite also pass their role.
-- Any account without a role key defaults to patient behaviour.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Always upsert the base users row (auth source-of-truth)
  INSERT INTO public.users (id, email, password_hash, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    'supabase_auth_managed',
    true,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        is_active = true;

  -- Determine role from signup metadata (defaults to 'patient')
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'patient');

  -- Only patients get an applicants row.
  -- Social workers, admins, and reviewers store their identity in their own tables.
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

-- Re-create the trigger (DROP IF EXISTS handles idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 4. Remove orphaned applicants rows for social workers ───────────────────
--
-- Only deletes rows that have no applications attached — belt-and-suspenders
-- guard against accidental data loss for any edge-case dual-role accounts.

DELETE FROM public.applicants ap
WHERE EXISTS (
  SELECT 1 FROM public.social_worker_profiles swp
  WHERE swp.user_id = ap.user_id
)
AND NOT EXISTS (
  SELECT 1 FROM public.applications a
  WHERE a.applicant_id = ap.id
);

COMMIT;
