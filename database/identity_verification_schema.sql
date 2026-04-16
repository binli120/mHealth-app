/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Identity Verification Schema
 * Adds driver's license / REAL ID verification fields to the applicants table
 * and a dedicated audit log table for verification attempts.
 *
 * Run after: mHealth_schema.sql
 */

-- ─── 1. Add identity verification columns to applicants ──────────────────────

ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS identity_status          TEXT    NOT NULL DEFAULT 'unverified'
    CHECK (identity_status IN ('unverified', 'pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS identity_verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_provider        TEXT    DEFAULT 'dl_barcode',
  ADD COLUMN IF NOT EXISTS identity_score           SMALLINT,          -- 0-100 match score
  ADD COLUMN IF NOT EXISTS dl_number_hash           TEXT,              -- SHA-256 of license number (never plain)
  ADD COLUMN IF NOT EXISTS dl_expiration_date       DATE,
  ADD COLUMN IF NOT EXISTS dl_issuing_state         TEXT;

-- ─── 2. Identity verification attempts log ───────────────────────────────────

CREATE TABLE IF NOT EXISTS identity_verification_attempts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id        UUID        NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,

  -- Result
  status              TEXT        NOT NULL CHECK (status IN ('verified', 'needs_review', 'failed')),
  score               SMALLINT    NOT NULL,           -- 0–100
  breakdown           JSONB       NOT NULL DEFAULT '{}',
  -- e.g. {"firstName":true,"lastName":true,"dateOfBirth":true,"address":false}

  -- License metadata (no PII — hashed/masked only)
  dl_number_hash      TEXT,                           -- SHA-256 of license number
  dl_expiration_date  DATE,
  dl_issuing_state    TEXT,
  is_expired          BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Audit
  attempted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address          TEXT,
  user_agent          TEXT
);

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_identity_attempts_applicant
  ON identity_verification_attempts (applicant_id);

CREATE INDEX IF NOT EXISTS idx_identity_attempts_user
  ON identity_verification_attempts (user_id);

CREATE INDEX IF NOT EXISTS idx_applicants_identity_status
  ON applicants (identity_status);

-- ─── 4. Row-Level Security ───────────────────────────────────────────────────

ALTER TABLE identity_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Applicants can see their own attempts
CREATE POLICY "identity_attempts_owner_select"
  ON identity_verification_attempts
  FOR SELECT
  USING (can_access_applicant(applicant_id));

-- Staff can see all attempts
CREATE POLICY "identity_attempts_staff_all"
  ON identity_verification_attempts
  FOR ALL
  USING (is_staff());

-- ─── 5. Helper view for staff review queue ───────────────────────────────────

CREATE OR REPLACE VIEW identity_pending_review AS
  SELECT
    a.id            AS applicant_id,
    a.first_name,
    a.last_name,
    a.identity_status,
    a.identity_score,
    a.dl_expiration_date,
    a.dl_issuing_state,
    iva.attempted_at AS last_attempt_at,
    iva.breakdown
  FROM applicants a
  LEFT JOIN LATERAL (
    SELECT breakdown, attempted_at
    FROM identity_verification_attempts
    WHERE applicant_id = a.id
    ORDER BY attempted_at DESC
    LIMIT 1
  ) iva ON TRUE
  WHERE a.identity_status IN ('pending', 'failed');
