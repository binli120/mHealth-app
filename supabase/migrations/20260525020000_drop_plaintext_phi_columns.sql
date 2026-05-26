-- Remove plaintext PHI columns from applicants (superseded by *_encrypted columns
-- added in 20260428100000_encrypt_phi_fields.sql).
--
-- Prerequisites:
--   1. backfill-phi-encryption.ts must have run successfully against all rows.
--   2. Verify: SELECT COUNT(*) FROM applicants
--              WHERE first_name_encrypted IS NULL AND first_name IS NOT NULL;
--              → should return 0 before running this migration.
--
-- All DROP COLUMN statements use IF EXISTS so re-running is safe.

-- ── 1. Drop plaintext PHI columns from applicants ────────────────────────────

ALTER TABLE public.applicants DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS last_name;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS dob;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS phone;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS address_line1;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS address_line2;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS city;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS state;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS zip;
ALTER TABLE public.applicants DROP COLUMN IF EXISTS citizenship_status;

-- ── 2. Fix the auth trigger so it no longer writes dropped columns ────────────
-- handle_new_user previously inserted first_name/last_name/phone from
-- raw_user_meta_data.  Those columns are gone; replace with an id-only insert.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.applicants (user_id, created_at)
  VALUES (NEW.id, now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 3. Null out legacy PHI in household_members ───────────────────────────────
-- No application code writes to this table anymore; PHI lives in the encrypted
-- Storage blob.  Clear residual plaintext data.

UPDATE public.household_members
SET
  first_name = NULL,
  last_name  = NULL,
  dob        = NULL
WHERE first_name IS NOT NULL OR last_name IS NOT NULL OR dob IS NOT NULL;

-- ── 4. Null out legacy PHI in incomes ────────────────────────────────────────

UPDATE public.incomes
SET
  employer_name  = NULL,
  monthly_amount = NULL
WHERE employer_name IS NOT NULL OR monthly_amount IS NOT NULL;

-- ── 5. Null applications.total_monthly_income ────────────────────────────────

UPDATE public.applications
SET total_monthly_income = NULL
WHERE total_monthly_income IS NOT NULL;

-- ── 6. Clear expired extracted_data from mobile_verify_sessions ──────────────
-- One-time backfill; ongoing cleanup belongs in a pg_cron job or Edge Function.

UPDATE public.mobile_verify_sessions
SET extracted_data = NULL
WHERE
  extracted_data IS NOT NULL AND
  created_at < now() - INTERVAL '24 hours';
