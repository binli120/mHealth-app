-- Identity Verification Schema — depends on applicants + users (20260301)
-- @author Bin Lee

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS identity_status      TEXT NOT NULL DEFAULT 'unverified'
    CHECK (identity_status IN ('unverified', 'pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_provider    TEXT DEFAULT 'dl_barcode',
  ADD COLUMN IF NOT EXISTS identity_score       SMALLINT,
  ADD COLUMN IF NOT EXISTS dl_number_hash       TEXT,
  ADD COLUMN IF NOT EXISTS dl_expiration_date   DATE,
  ADD COLUMN IF NOT EXISTS dl_issuing_state     TEXT;

CREATE TABLE IF NOT EXISTS public.identity_verification_attempts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id       UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  status             TEXT        NOT NULL CHECK (status IN ('verified', 'needs_review', 'failed')),
  score              SMALLINT    NOT NULL,
  breakdown          JSONB       NOT NULL DEFAULT '{}',
  dl_number_hash     TEXT,
  dl_expiration_date DATE,
  dl_issuing_state   TEXT,
  is_expired         BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address         TEXT,
  user_agent         TEXT
);

CREATE INDEX IF NOT EXISTS idx_identity_attempts_applicant   ON public.identity_verification_attempts (applicant_id);
CREATE INDEX IF NOT EXISTS idx_identity_attempts_user        ON public.identity_verification_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_applicants_identity_status    ON public.applicants (identity_status);

ALTER TABLE public.identity_verification_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_attempts_owner_select ON public.identity_verification_attempts;
CREATE POLICY identity_attempts_owner_select ON public.identity_verification_attempts FOR SELECT
  USING (public.can_access_applicant(applicant_id));
DROP POLICY IF EXISTS identity_attempts_staff_all ON public.identity_verification_attempts;
CREATE POLICY identity_attempts_staff_all    ON public.identity_verification_attempts FOR ALL
  USING (public.is_staff());

CREATE OR REPLACE VIEW public.identity_pending_review AS
  SELECT
    a.id              AS applicant_id,
    a.first_name,
    a.last_name,
    a.identity_status,
    a.identity_score,
    a.dl_expiration_date,
    a.dl_issuing_state,
    iva.attempted_at  AS last_attempt_at,
    iva.breakdown
  FROM public.applicants a
  LEFT JOIN LATERAL (
    SELECT breakdown, attempted_at
    FROM public.identity_verification_attempts
    WHERE applicant_id = a.id
    ORDER BY attempted_at DESC LIMIT 1
  ) iva ON TRUE
  WHERE a.identity_status IN ('pending', 'failed');
