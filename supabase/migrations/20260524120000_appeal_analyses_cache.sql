-- @author: Bin Lee
-- @email: blee@healthcompass.cloud
--
-- Persists appeal analysis results so the same input never re-runs the AI
-- pipeline.  Cache key = (user_id, denial_reason_id, input_hash) where
-- input_hash is SHA-256(denialDetails + NUL + documentText).

BEGIN;

CREATE TABLE IF NOT EXISTS appeal_analyses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL,
  denial_reason_id TEXT        NOT NULL,
  input_hash       TEXT        NOT NULL,
  explanation      TEXT        NOT NULL DEFAULT '',
  appeal_letter    TEXT        NOT NULL DEFAULT '',
  evidence_checklist JSONB     NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_appeal_analysis UNIQUE (user_id, denial_reason_id, input_hash)
);

CREATE INDEX IF NOT EXISTS idx_appeal_analyses_lookup
  ON appeal_analyses (user_id, denial_reason_id, input_hash);

ALTER TABLE appeal_analyses ENABLE ROW LEVEL SECURITY;

-- Users may read their own cached analyses (anon key path in production).
CREATE POLICY "appeal_analyses_select_own"
  ON appeal_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Users may insert their own analyses.
CREATE POLICY "appeal_analyses_insert_own"
  ON appeal_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMIT;
