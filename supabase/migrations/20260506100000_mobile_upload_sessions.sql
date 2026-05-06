-- @author: Bin Lee
-- @email: blee@healthcompass.cloud
--
-- Cross-device document upload sessions
-- Allows a desktop user to scan a QR code with their phone to take a photo
-- and upload a document (Government-Issued ID, Proof of Income, etc.).

CREATE TABLE IF NOT EXISTS public.mobile_upload_sessions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token                   TEXT        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  user_id                 UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  application_id          UUID        NOT NULL,
  document_type           TEXT,
  required_document_label TEXT,
  status                  TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired')),
  -- Populated once the mobile device completes the upload
  document_id             UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at              TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_upload_sessions_token  ON public.mobile_upload_sessions (token);
CREATE INDEX IF NOT EXISTS idx_mobile_upload_sessions_user   ON public.mobile_upload_sessions (user_id, status);

ALTER TABLE public.mobile_upload_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_upload_sessions_owner ON public.mobile_upload_sessions;
CREATE POLICY mobile_upload_sessions_owner ON public.mobile_upload_sessions FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mobile_upload_sessions_staff ON public.mobile_upload_sessions;
CREATE POLICY mobile_upload_sessions_staff ON public.mobile_upload_sessions FOR ALL
  USING (public.is_staff());
