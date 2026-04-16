/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Persistent long-term memory for the ReAct agent pipeline (Phase 4).
 *
 * One row per user.  Facts extracted in turn 2 are available in turn 10
 * and across sessions without re-extraction.
 *
 * extracted_facts — Partial<ScreenerData>  (age, income, household size, …)
 * form_progress   — Partial<FormFields>    (section completion state)
 *
 * The application merges new facts with existing ones using jsonb ||,
 * so only newly-discovered keys are overwritten; prior knowledge is preserved.
 */

CREATE TABLE IF NOT EXISTS user_agent_memory (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase auth user id (uuid stored as text for flexibility)
  user_id          TEXT        NOT NULL UNIQUE,

  -- Optional: tie memory to a specific conversation session
  session_id       TEXT,

  -- Extracted eligibility facts (Partial<ScreenerData>)
  extracted_facts  JSONB       NOT NULL DEFAULT '{}',

  -- Form section completion state (Partial<FormFields>)
  form_progress    JSONB       NOT NULL DEFAULT '{}',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by user (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_user_agent_memory_user_id
  ON user_agent_memory (user_id);

-- RLS: every user can only read and write their own memory row
ALTER TABLE user_agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_memory_owner"
  ON user_agent_memory
  FOR ALL
  USING (user_id = auth.uid()::text);

CREATE POLICY "agent_memory_staff"
  ON user_agent_memory
  FOR ALL
  USING (is_staff());
