-- =============================================================================
-- Migration: add require_2fa_reviewer + require_2fa_social_worker settings
-- @author: Bin Lee <blee@healthcompass.cloud>
--
-- Adds two new admin_settings rows that gate aal2 (MFA) enforcement for the
-- reviewer and social-worker auth guards.  Both default to 'false' so existing
-- sessions continue to work; an admin can flip either to 'true' to enable
-- enforcement without a code deploy.
--
-- Idempotent: ON CONFLICT DO NOTHING leaves any existing value intact.
-- =============================================================================

BEGIN;

INSERT INTO public.admin_settings (key, value)
VALUES
  ('require_2fa_reviewer',      'false'),
  ('require_2fa_social_worker', 'false')
ON CONFLICT (key) DO NOTHING;

COMMIT;
