/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * Cross-device identity verification session
 *
 * When a desktop user clicks "Scan with Phone", a short-lived session token
 * is created here. The desktop polls for its status while the mobile device
 * scans the DL barcode and submits the result via the token URL.
 *
 * Run after: identity_verification_schema.sql
 */

CREATE TABLE IF NOT EXISTS mobile_verify_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Random URL-safe token shown in the QR code.
  -- Generated application-side (Node randomBytes base64url) to avoid the pg17-only
  -- base64url encoding in encode(). The DEFAULT here is a hex fallback for tooling
  -- that inserts rows directly; the application always supplies the value explicitly.
  token           TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),

  -- The authenticated desktop user who initiated the session
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applicant_id    UUID        NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,

  -- Lifecycle
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),

  -- Verification result (populated when mobile completes scan)
  verify_status   TEXT        CHECK (verify_status IN ('verified', 'needs_review', 'failed')),
  verify_score    SMALLINT,
  verify_breakdown JSONB,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  completed_at    TIMESTAMPTZ
);

-- Auto-expire index for cleanup
CREATE INDEX IF NOT EXISTS idx_mobile_verify_sessions_token
  ON mobile_verify_sessions (token);

CREATE INDEX IF NOT EXISTS idx_mobile_verify_sessions_user
  ON mobile_verify_sessions (user_id, status);

-- RLS: only the owning user can read/write their own sessions
ALTER TABLE mobile_verify_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mobile_sessions_owner"
  ON mobile_verify_sessions
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "mobile_sessions_staff"
  ON mobile_verify_sessions
  FOR ALL
  USING (is_staff());
