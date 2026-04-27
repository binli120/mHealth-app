-- Server-side session revocation list.
-- Used by lib/auth/require-auth.ts to reject access tokens after admin force logout.
-- @author Bin Lee

CREATE TABLE IF NOT EXISTS public.revoked_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT,
  token_hash  TEXT,
  reason      TEXT        NOT NULL DEFAULT 'manual_revocation',
  revoked_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  CONSTRAINT revoked_sessions_subject_check
    CHECK (user_id IS NOT NULL OR session_id IS NOT NULL OR token_hash IS NOT NULL),
  CONSTRAINT revoked_sessions_token_hash_check
    CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE public.revoked_sessions IS
  'Revoked access-token sessions. Rows may target an exact token hash, a Supabase session_id/sid/jti claim, or all tokens for a user issued before revoked_at.';

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_user_active
  ON public.revoked_sessions (user_id, revoked_at DESC);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_session_active
  ON public.revoked_sessions (session_id)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_revoked_sessions_token_hash
  ON public.revoked_sessions (token_hash)
  WHERE token_hash IS NOT NULL;

ALTER TABLE public.revoked_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS revoked_sessions_staff_select ON public.revoked_sessions;
CREATE POLICY revoked_sessions_staff_select
  ON public.revoked_sessions FOR SELECT TO authenticated
  USING (public.is_staff());
