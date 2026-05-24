-- @author: Bin Lee
-- @email: blee@healthcompass.cloud
--
-- Remove plaintext PHI columns from applicants (now encrypted in *_encrypted columns),
-- null out legacy PHI in household_members / incomes (no longer populated by the app),
-- fix the auth trigger to stop writing plaintext name/phone,
-- and add a TTL cleanup for mobile_verify_sessions.
--
-- Prerequisites:
--   1. backfill-phi-encryption.ts must have run successfully against all rows.
--   2. Verify: SELECT COUNT(*) FROM applicants WHERE first_name_encrypted IS NULL AND first_name IS NOT NULL;
--              → should return 0 before running this migration.
--
-- Run order: run after confirming the backfill above.

-- ── 1. Drop plaintext PHI columns from applicants ────────────────────────────
-- These are superseded by first_name_encrypted, last_name_encrypted, etc.
-- The backfill script must have fully migrated all rows first.
-- One statement per column for compatibility with SQL clients that split on commas.

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

-- ── 2. Fix the auth trigger (on_auth_user_created / handle_new_user) ─────────
-- The existing trigger inserts first_name, last_name, phone from
-- raw_user_meta_data into applicants. After dropping those columns above this
-- will error — replace the trigger body so it only creates the row by user_id.
-- Staff-facing name/phone is handled by social_worker_profiles instead.

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
-- No application code writes to this table anymore; PHI now lives in the
-- encrypted Storage blob.  Clear residual plaintext data.

UPDATE public.household_members
SET
  first_name = NULL,
  last_name  = NULL,
  dob        = NULL
WHERE first_name IS NOT NULL OR last_name IS NOT NULL OR dob IS NOT NULL;

-- Optional long-term: DROP TABLE public.household_members;
-- Hold off until confirmed no reporting queries use it.

-- ── 4. Null out legacy PHI in incomes ────────────────────────────────────────
-- monthly_amount and employer_name are no longer populated from the wizard.

UPDATE public.incomes
SET
  employer_name  = NULL,
  monthly_amount = NULL
WHERE employer_name IS NOT NULL OR monthly_amount IS NOT NULL;

-- ── 5. Null applications.total_monthly_income ────────────────────────────────

UPDATE public.applications
SET total_monthly_income = NULL
WHERE total_monthly_income IS NOT NULL;

-- ── 6. Add TTL on mobile_verify_sessions.extracted_data ──────────────────────
-- Clear extracted_data (name + address from driver's license) after 24 hours.
-- The session itself can remain for audit; only the PHI payload is cleared.

UPDATE public.mobile_verify_sessions
SET extracted_data = NULL
WHERE
  extracted_data IS NOT NULL AND
  created_at < now() - INTERVAL '24 hours';

-- For ongoing cleanup, schedule this via pg_cron or a nightly Supabase
-- Edge Function:
--   UPDATE mobile_verify_sessions SET extracted_data = NULL
--   WHERE extracted_data IS NOT NULL AND created_at < now() - INTERVAL '24 hours';
