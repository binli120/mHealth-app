-- =============================================================================
-- Migration: phi_draft_resume_id + phi_draft_key_enc columns on applications
-- @author: Bin Lee <blee@healthcompass.cloud>
--
-- Adds the PHI draft resume columns to applications if they are missing.
-- The baseline schema (20260101000000) already includes these for fresh
-- installs; this file handles incremental apply on existing cloud databases.
--
-- Columns:
--   phi_draft_resume_id  UUID  — foreign key into the encrypted PHI blob store
--   phi_draft_key_enc    TEXT  — server-side encrypted AES key for the PHI blob
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS (Postgres 9.6+).
-- =============================================================================

BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS phi_draft_resume_id UUID,
  ADD COLUMN IF NOT EXISTS phi_draft_key_enc    TEXT;

COMMIT;
