-- Rate-limit counters — shared across all app instances (multi-instance safe).
-- Each row represents a (limiter-key, time-window) bucket. The count is
-- incremented atomically by DbRateLimiter.checkAsync().

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 0,
  CONSTRAINT rate_limit_counters_pkey PRIMARY KEY (key, window_start)
);

-- Index for the periodic cleanup function
CREATE INDEX IF NOT EXISTS rate_limit_counters_window_start_idx
  ON public.rate_limit_counters (window_start);

-- Periodic cleanup: remove windows older than 2 hours to keep the table small.
CREATE OR REPLACE FUNCTION public.purge_expired_rate_limit_counters()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.rate_limit_counters
  WHERE window_start < (now() - interval '2 hours');
$$;

-- Disable RLS — rate-limit rows contain no PHI and are written only via
-- the server-side service-role connection pool, never by user JWTs.
ALTER TABLE public.rate_limit_counters DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rate_limit_counters IS
  'Shared rate-limit window counters. Written by DbRateLimiter (lib/server/rate-limit.ts). '
  'Purged periodically by purge_expired_rate_limit_counters().';
