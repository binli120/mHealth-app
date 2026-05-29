-- =============================================================================
-- Migration: user_agent_memory table
-- @author: Bin Lee <blee@healthcompass.cloud>
--
-- Creates the user_agent_memory table if it does not already exist on the
-- target database.  The baseline schema (20260101000000) already contains
-- this table for fresh installs; this file exists so the table can be added
-- incrementally to cloud databases that were initialised from pre-squash
-- incremental migrations.
--
-- Idempotent: safe to run multiple times.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_agent_memory (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL UNIQUE,
  session_id      TEXT,
  extracted_facts JSONB       NOT NULL DEFAULT '{}',
  form_progress   JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_agent_memory IS
  'Stores cross-session AI agent memory: extracted facts and form progress '
  'keyed by user_id (text, matches auth.users.id cast to text).';

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_agent_memory_user_id
  ON public.user_agent_memory (user_id);

-- RLS
ALTER TABLE public.user_agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_memory_owner" ON public.user_agent_memory;
DROP POLICY IF EXISTS "agent_memory_staff"  ON public.user_agent_memory;

CREATE POLICY "agent_memory_owner"
  ON public.user_agent_memory FOR ALL
  USING (user_id = auth.uid()::text);

CREATE POLICY "agent_memory_staff"
  ON public.user_agent_memory FOR ALL
  USING (public.is_staff());

COMMIT;
