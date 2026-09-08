-- Lock down the customer personal-data reset RPC.
--
-- 20260806000001_personal_data_reset.sql created these SECURITY DEFINER
-- functions and only did `REVOKE ALL ... FROM PUBLIC`. That is not enough on
-- Supabase: the project ships
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
-- so every new function in `public` is granted EXECUTE to `anon` and
-- `authenticated` regardless of the PUBLIC revoke. That exposes
--   POST /rest/v1/rpc/reset_customer_personal_data
-- to any holder of the public anon key (it ships in the client bundle as
-- NEXT_PUBLIC_SUPABASE_ANON_KEY): a request with any user UUID runs in
-- definer context and performs a broad, unauthenticated wipe of that user's
-- applicant/application/message/audit records. Table RLS does not gate a
-- SECURITY DEFINER function.
--
-- Same pattern already handled for the RLS helper functions in
-- 20260623000005_revoke_anon_execute_security_definer_fns.sql; the Aug reset
-- migration missed it.
--
-- Only server code calls these, over the direct DATABASE_URL pool
-- (lib/db/personal-data-reset.ts) which connects as the owner role, not via
-- PostgREST — so revoking anon/authenticated does not affect the app path.

REVOKE EXECUTE ON FUNCTION public.reset_customer_personal_data(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_customer_personal_data(uuid)
  TO service_role;

-- Trigger function: never a valid RPC target (returns `trigger`), but revoke
-- for consistency and defense in depth.
REVOKE EXECUTE ON FUNCTION public.guard_personal_data_reset_write()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.reset_customer_personal_data(uuid) IS
  'Server-only, idempotent customer data reset. Preserves auth identity, '
  'public.users, and user_roles. EXECUTE restricted to service_role — '
  'see 20260907000001.';
