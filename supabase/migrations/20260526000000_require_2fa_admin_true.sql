-- Migration: require_2fa_admin setting defaults to true
--
-- The access_management migration seeded this setting as 'false', which
-- contradicts the code-level MFA enforcement already in place for admin
-- routes. Correct the schema default and update any existing rows so the
-- DB policy accurately reflects the enforced behavior.
--
-- NOTE: require-admin.ts enforces MFA unconditionally for production
-- requests regardless of this setting. The setting is read at runtime to
-- detect misconfiguration: a 'false' value triggers a security-level log
-- entry and MFA is still required (belt and suspenders).

-- Correct the existing row (ON CONFLICT ... DO NOTHING prevented the
-- original insert from being fixed by re-running the migration).
INSERT INTO public.admin_settings (key, value, updated_at)
  VALUES ('require_2fa_admin', 'true', now())
  ON CONFLICT (key) DO UPDATE
    SET value      = 'true',
        updated_at = now()
    WHERE public.admin_settings.value = 'false';
