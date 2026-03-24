/**
 * Collaborative Session Schema
 * Screen-share + chat sessions between social workers and patients.
 * Run after social_worker_schema.sql
 * @author Bin Lee
 */

-- ── Collaborative sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collaborative_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sw_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  ended_by          UUID        REFERENCES auth.users(id),
  invite_message    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_sw
  ON public.collaborative_sessions(sw_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_patient
  ON public.collaborative_sessions(patient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_status
  ON public.collaborative_sessions(status);

-- ── Session messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.collaborative_sessions(id) ON DELETE CASCADE,
  sender_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL DEFAULT 'text'
    CHECK (type IN ('text', 'voice')),
  content       TEXT,
  storage_path  TEXT,
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_msgs_session
  ON public.session_messages(session_id, created_at);

-- ── auto-update updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_session_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_updated_at ON public.collaborative_sessions;
CREATE TRIGGER trg_session_updated_at
  BEFORE UPDATE ON public.collaborative_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_session_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.collaborative_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages       ENABLE ROW LEVEL SECURITY;

-- Sessions: SW or patient who is a participant can select
CREATE POLICY sessions_select
  ON public.collaborative_sessions FOR SELECT TO authenticated
  USING (
    sw_user_id = public.request_user_id()
    OR patient_user_id = public.request_user_id()
    OR public.is_staff()
  );

-- Only the SW (or staff) can create a session
CREATE POLICY sessions_insert
  ON public.collaborative_sessions FOR INSERT TO authenticated
  WITH CHECK (sw_user_id = public.request_user_id() OR public.is_staff());

-- SW or patient can update status (accept, decline, start, end)
CREATE POLICY sessions_update
  ON public.collaborative_sessions FOR UPDATE TO authenticated
  USING (
    sw_user_id = public.request_user_id()
    OR patient_user_id = public.request_user_id()
    OR public.is_staff()
  )
  WITH CHECK (
    sw_user_id = public.request_user_id()
    OR patient_user_id = public.request_user_id()
    OR public.is_staff()
  );

-- Messages: participants can select
CREATE POLICY session_msgs_select
  ON public.session_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborative_sessions s
      WHERE s.id = session_id
        AND (
          s.sw_user_id     = public.request_user_id()
          OR s.patient_user_id = public.request_user_id()
        )
    )
    OR public.is_staff()
  );

-- Messages: participants can insert (only when session is active)
CREATE POLICY session_msgs_insert
  ON public.session_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.request_user_id()
    AND EXISTS (
      SELECT 1 FROM public.collaborative_sessions s
      WHERE s.id = session_id
        AND s.status = 'active'
        AND (
          s.sw_user_id     = public.request_user_id()
          OR s.patient_user_id = public.request_user_id()
        )
    )
  );

-- ── Extend notifications.type check constraint ────────────────────────────────
-- NOTE: notifications is owned by supabase_admin; run the two statements below
-- as that role if this migration is replayed from scratch.
-- They have already been applied; keeping them here for documentation only.
--
-- ALTER TABLE public.notifications
--   DROP CONSTRAINT IF EXISTS notifications_type_check;
--
-- ALTER TABLE public.notifications
--   ADD CONSTRAINT notifications_type_check
--   CHECK (type IN (
--     'status_change', 'document_request', 'renewal_reminder', 'deadline',
--     'general', 'session_invite', 'session_starting'
--   ));
