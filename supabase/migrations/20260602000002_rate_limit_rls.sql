-- Enable RLS on rate_limit_counters (was explicitly disabled in baseline).
-- This table is server-only; no authenticated user should read or write it directly.
-- All access goes through service-role (bypasses RLS) or the increment_rate_limit function.

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Deny all access to authenticated and anonymous roles.
-- Service role always bypasses RLS, so server-side functions continue to work.
