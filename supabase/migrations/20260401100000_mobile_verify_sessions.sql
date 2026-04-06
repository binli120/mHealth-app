-- Cross-device identity verification sessions — depends on identity_verification (20260331)
-- @author Bin Lee

CREATE TABLE IF NOT EXISTS public.mobile_verify_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token            TEXT        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  user_id          UUID        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  applicant_id     UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  verify_status    TEXT        CHECK (verify_status IN ('verified', 'needs_review', 'failed')),
  verify_score     SMALLINT,
  verify_breakdown JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_verify_sessions_token ON public.mobile_verify_sessions (token);
CREATE INDEX IF NOT EXISTS idx_mobile_verify_sessions_user  ON public.mobile_verify_sessions (user_id, status);

ALTER TABLE public.mobile_verify_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_sessions_owner ON public.mobile_verify_sessions;
CREATE POLICY mobile_sessions_owner ON public.mobile_verify_sessions FOR ALL
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS mobile_sessions_staff ON public.mobile_verify_sessions;
CREATE POLICY mobile_sessions_staff ON public.mobile_verify_sessions FOR ALL
  USING (public.is_staff());
