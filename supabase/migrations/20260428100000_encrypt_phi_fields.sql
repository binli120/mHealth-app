-- ─────────────────────────────────────────────────────────────────────────────
-- Encrypt PHI fields on the applicants table
--
-- HIPAA §164.312(a)(2)(iv) — Encryption and Decryption
-- Encrypt all stored PHI at rest.  Fields encrypted with AES-256-GCM via the
-- application-layer encryptField() function (PROFILE_ENCRYPTION_KEY env var).
--
-- Migration strategy (zero-downtime dual-write window)
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. This migration adds *_encrypted TEXT columns for each PHI field.
-- 2. Application code immediately writes only to *_encrypted columns and reads
--    *_encrypted with a fallback to the legacy plaintext column when the
--    encrypted column is NULL (pre-backfill rows).
-- 3. Run: pnpm tsx scripts/backfill-phi-encryption.ts
--    to encrypt all existing plaintext values into the new columns.
-- 4. After the backfill is verified, run a follow-up migration to NULL out
--    and then DROP the plaintext columns (tracked in TODO comment below).
--
-- About driver's licence number
-- ─────────────────────────────────────────────────────────────────────────────
-- dl_number_hash already stores only a SHA-256 hash of the licence number.
-- The plaintext is never persisted.  No change is needed for that column.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.applicants
  -- Name
  ADD COLUMN IF NOT EXISTS first_name_encrypted  TEXT,
  ADD COLUMN IF NOT EXISTS last_name_encrypted   TEXT,

  -- Date of birth — stored as encrypted text (ISO date string "YYYY-MM-DD")
  ADD COLUMN IF NOT EXISTS dob_encrypted         TEXT,

  -- Contact
  ADD COLUMN IF NOT EXISTS phone_encrypted       TEXT,

  -- Address
  ADD COLUMN IF NOT EXISTS address_line1_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_line2_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS city_encrypted         TEXT,
  ADD COLUMN IF NOT EXISTS state_encrypted        TEXT,
  ADD COLUMN IF NOT EXISTS zip_encrypted          TEXT;

-- TODO (post-backfill cleanup migration):
--   UPDATE public.applicants SET first_name = NULL WHERE first_name_encrypted IS NOT NULL;
--   UPDATE public.applicants SET last_name  = NULL WHERE last_name_encrypted  IS NOT NULL;
--   ... repeat for each column ...
--   ALTER TABLE public.applicants
--     DROP COLUMN first_name,
--     DROP COLUMN last_name,
--     DROP COLUMN dob,
--     DROP COLUMN phone,
--     DROP COLUMN address_line1,
--     DROP COLUMN address_line2,
--     DROP COLUMN city,
--     DROP COLUMN state,
--     DROP COLUMN zip;
