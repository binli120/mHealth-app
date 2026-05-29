-- =============================================================================
-- Migration: drop plaintext PHI columns from applicants
-- @author: Bin Lee <blee@healthcompass.cloud>
--
-- Removes the 10 plaintext PHI columns that were superseded by the
-- AES-256-GCM *_encrypted equivalents.  All data was nulled or migrated
-- before this DROP; the encrypted columns remain.
--
-- Also rebuilds the identity_pending_review view without the plaintext names,
-- and repairs the handle_new_user trigger to stop writing PHI from auth metadata.
--
-- Idempotent: DROP COLUMN IF EXISTS is a no-op when the column is already gone.
-- =============================================================================

BEGIN;

-- ── 1. Drop plaintext PHI columns from applicants ────────────────────────────

ALTER TABLE public.applicants
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS middle_name,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS phone_alt,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS zip,
  DROP COLUMN IF EXISTS ssn;

-- ── 2. Null out legacy PHI in related tables ──────────────────────────────────
-- These tables store legacy form data; no application code writes to them,
-- but plaintext PHI may remain from pre-encryption rows.

UPDATE public.household_members
  SET first_name = NULL,
      last_name  = NULL,
      dob        = NULL
  WHERE first_name IS NOT NULL
     OR last_name  IS NOT NULL
     OR dob        IS NOT NULL;

UPDATE public.incomes
  SET employer_name  = NULL
  WHERE employer_name IS NOT NULL;

-- ── 3. Rebuild identity_pending_review without plaintext names ────────────────

CREATE OR REPLACE VIEW public.identity_pending_review AS
  SELECT
    a.id              AS applicant_id,
    a.identity_status,
    a.identity_score,
    a.dl_expiration_date,
    a.dl_issuing_state,
    iva.attempted_at  AS last_attempt_at,
    iva.breakdown
  FROM public.applicants a
  LEFT JOIN LATERAL (
    SELECT breakdown, attempted_at
    FROM public.identity_verification_attempts
    WHERE applicant_id = a.id
    ORDER BY attempted_at DESC LIMIT 1
  ) iva ON TRUE
  WHERE a.identity_status IN ('pending', 'failed');

-- ── 4. Rewrite handle_new_user trigger — stop writing PHI from auth metadata ──

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Insert only the non-PHI anchor columns.
  -- All PHI (name, phone, address, etc.) must be provided through the
  -- application layer using encrypted fields; never read from auth metadata.
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;
