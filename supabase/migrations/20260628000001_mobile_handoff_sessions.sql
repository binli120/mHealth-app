-- supabase/migrations/20260628000001_mobile_handoff_sessions.sql

CREATE TABLE mobile_handoff_sessions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token                   text NOT NULL UNIQUE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type            text NOT NULL CHECK (context_type IN ('intake_chat','mh_chat','id_verify','voice_message','doc_upload')),
  context_payload         jsonb NOT NULL DEFAULT '{}',
  encrypted_refresh_token text NOT NULL,
  status                  text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','expired')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  expires_at              timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  completed_at            timestamptz,
  progress_summary        jsonb
);

CREATE INDEX mobile_handoff_sessions_user_status_idx ON mobile_handoff_sessions (user_id, status);
CREATE INDEX mobile_handoff_sessions_token_idx ON mobile_handoff_sessions (token);

-- RLS: users can only see their own sessions
ALTER TABLE mobile_handoff_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_handoff_sessions"
  ON mobile_handoff_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
