-- ── Social Worker Messaging Schema ────────────────────────────────────────────
-- Engagement requests: patient initiates a request to work with a SW
-- Direct messages: async 1:1 chat between patient and their assigned SW
--
-- @author Bin Lee
-- @email binlee120@gmail.com
-- Run after: social_worker_schema.sql, notifications_schema.sql, collaborative_session_schema.sql

-- ── Engagement requests ──────────────────────────────────────────────────────
-- A patient sends a request to a social worker asking to be paired together.
-- The SW can accept (which grants access) or politely reject.

CREATE TABLE IF NOT EXISTS public.sw_engagement_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sw_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  patient_message   TEXT,
  rejection_note    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active (pending) request per patient-SW pair at a time
CREATE UNIQUE INDEX IF NOT EXISTS sw_engagement_requests_active_uq
  ON public.sw_engagement_requests (patient_user_id, sw_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS sw_engagement_requests_patient_idx
  ON public.sw_engagement_requests (patient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sw_engagement_requests_sw_idx
  ON public.sw_engagement_requests (sw_user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_sw_request_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sw_engagement_requests_updated_at ON public.sw_engagement_requests;
CREATE TRIGGER sw_engagement_requests_updated_at
  BEFORE UPDATE ON public.sw_engagement_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_sw_request_updated_at();

ALTER TABLE public.sw_engagement_requests ENABLE ROW LEVEL SECURITY;

-- Patients see/manage their own requests
CREATE POLICY "Patients see own engagement requests"
  ON public.sw_engagement_requests FOR SELECT
  USING (patient_user_id = auth.uid());

CREATE POLICY "Patients create engagement requests"
  ON public.sw_engagement_requests FOR INSERT
  WITH CHECK (patient_user_id = auth.uid());

CREATE POLICY "Patients cancel own pending requests"
  ON public.sw_engagement_requests FOR UPDATE
  USING (patient_user_id = auth.uid() AND status = 'pending');

-- SWs see requests directed at them and can accept/reject
CREATE POLICY "SWs see requests for them"
  ON public.sw_engagement_requests FOR SELECT
  USING (sw_user_id = auth.uid());

CREATE POLICY "SWs respond to pending requests"
  ON public.sw_engagement_requests FOR UPDATE
  USING (sw_user_id = auth.uid() AND status = 'pending');

-- Staff see all
CREATE POLICY "Staff see all engagement requests"
  ON public.sw_engagement_requests FOR ALL
  USING (public.is_staff(auth.uid()));


-- ── Direct messages ───────────────────────────────────────────────────────────
-- Async 1:1 messages between a patient and their assigned SW.
-- Supports text, voice recording, and image uploads.

CREATE TABLE IF NOT EXISTS public.sw_direct_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sw_user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_type     TEXT        NOT NULL DEFAULT 'text'
                               CHECK (message_type IN ('text', 'voice', 'image')),
  content          TEXT,       -- text body OR original filename for media
  storage_path     TEXT,       -- Supabase Storage path for voice/image files
  duration_sec     INTEGER,    -- voice duration in seconds
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sw_direct_messages_thread_idx
  ON public.sw_direct_messages (sw_user_id, patient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sw_direct_messages_sender_idx
  ON public.sw_direct_messages (sender_id, created_at DESC);

-- Unread messages per recipient
CREATE INDEX IF NOT EXISTS sw_direct_messages_unread_idx
  ON public.sw_direct_messages (sw_user_id, patient_user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.sw_direct_messages ENABLE ROW LEVEL SECURITY;

-- Only participants (the SW and the patient) in this thread can see messages
CREATE POLICY "DM participants can view messages"
  ON public.sw_direct_messages FOR SELECT
  USING (sw_user_id = auth.uid() OR patient_user_id = auth.uid());

-- Participants can insert IF they have an active SW-patient relationship
CREATE POLICY "DM participants can send messages"
  ON public.sw_direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (sw_user_id = auth.uid() OR patient_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.patient_social_worker_access psa
      WHERE psa.patient_user_id = sw_direct_messages.patient_user_id
        AND psa.social_worker_user_id = sw_direct_messages.sw_user_id
        AND psa.is_active = true
    )
  );

-- Participants can mark messages as read
CREATE POLICY "DM participants can mark read"
  ON public.sw_direct_messages FOR UPDATE
  USING (sw_user_id = auth.uid() OR patient_user_id = auth.uid());

CREATE POLICY "Staff see all DMs"
  ON public.sw_direct_messages FOR ALL
  USING (public.is_staff(auth.uid()));


-- ── Extend notification type constraint ───────────────────────────────────────
-- Adds sw_engagement_request, sw_engagement_accepted, sw_engagement_rejected,
-- and new_direct_message to the allowed notification types.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'status_change',
    'document_request',
    'renewal_reminder',
    'deadline',
    'general',
    'session_invite',
    'session_starting',
    'sw_engagement_request',
    'sw_engagement_accepted',
    'sw_engagement_rejected',
    'new_direct_message'
  ));
