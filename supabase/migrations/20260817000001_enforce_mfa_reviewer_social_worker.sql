-- =============================================================================
-- Migration: enforce require_2fa_reviewer + require_2fa_social_worker
-- @author: Bin Lee <blee@comura.ai>
--
-- Sprint 1 production-readiness item (HIPAA_COMPLIANCE.md §9, finding #3):
-- "MFA enforced for admin; not yet enforced for social_worker/reviewer".
--
-- lib/auth/require-reviewer.ts and lib/auth/require-social-worker.ts already
-- gate aal2 (MFA) enforcement on these two admin_settings flags, but the
-- 20260529000004 migration seeded both to 'false' so existing sessions kept
-- working while MFA enrollment rolled out. Ahead of onboarding real trial
-- users on production, flip both to 'true', mirroring how baseline_seed.sql
-- already force-corrects require_2fa_admin on every run.
--
-- Idempotent: safe to re-run.
-- =============================================================================

BEGIN;

UPDATE public.admin_settings
SET value = 'true', updated_at = now()
WHERE key IN ('require_2fa_reviewer', 'require_2fa_social_worker')
  AND value <> 'true';

COMMIT;
