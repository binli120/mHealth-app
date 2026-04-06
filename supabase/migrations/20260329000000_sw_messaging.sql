-- SW Messaging: engagement requests + direct messages
-- Depends on: social_worker_schema (20260323), notifications (20260324), collaborative_sessions (20260322)
-- @author Bin Lee

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

CREATE UNIQUE INDEX IF NOT EXISTS sw_engagement_requests_active_uq
  ON public.sw_engagement_requests (patient_user_id, sw_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS sw_engagement_requests_patient_idx
  ON public.sw_engagement_requests (patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_engagement_requests_sw_idx
  ON public.sw_engagement_requests (sw_user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_sw_request_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS sw_engagement_requests_updated_at ON public.sw_engagement_requests;
CREATE TRIGGER sw_engagement_requests_updated_at
  BEFORE UPDATE ON public.sw_engagement_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_sw_request_updated_at();

ALTER TABLE public.sw_engagement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients see own engagement requests" ON public.sw_engagement_requests;
CREATE POLICY "Patients see own engagement requests"   ON public.sw_engagement_requests FOR SELECT USING (patient_user_id = auth.uid());
DROP POLICY IF EXISTS "Patients create engagement requests" ON public.sw_engagement_requests;
CREATE POLICY "Patients create engagement requests"    ON public.sw_engagement_requests FOR INSERT WITH CHECK (patient_user_id = auth.uid());
DROP POLICY IF EXISTS "Patients cancel own pending requests" ON public.sw_engagement_requests;
CREATE POLICY "Patients cancel own pending requests"   ON public.sw_engagement_requests FOR UPDATE USING (patient_user_id = auth.uid() AND status = 'pending');
DROP POLICY IF EXISTS "SWs see requests for them" ON public.sw_engagement_requests;
CREATE POLICY "SWs see requests for them"              ON public.sw_engagement_requests FOR SELECT USING (sw_user_id = auth.uid());
DROP POLICY IF EXISTS "SWs respond to pending requests" ON public.sw_engagement_requests;
CREATE POLICY "SWs respond to pending requests"        ON public.sw_engagement_requests FOR UPDATE USING (sw_user_id = auth.uid() AND status = 'pending');
DROP POLICY IF EXISTS "Staff see all engagement requests" ON public.sw_engagement_requests;
CREATE POLICY "Staff see all engagement requests"      ON public.sw_engagement_requests FOR ALL   USING (public.is_staff());

CREATE TABLE IF NOT EXISTS public.sw_direct_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sw_user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_type     TEXT        NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'voice', 'image')),
  content          TEXT,
  storage_path     TEXT,
  duration_sec     INTEGER,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sw_direct_messages_thread_idx ON public.sw_direct_messages (sw_user_id, patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_direct_messages_sender_idx ON public.sw_direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_direct_messages_unread_idx ON public.sw_direct_messages (sw_user_id, patient_user_id) WHERE read_at IS NULL;

ALTER TABLE public.sw_direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DM participants can view messages" ON public.sw_direct_messages;
CREATE POLICY "DM participants can view messages" ON public.sw_direct_messages FOR SELECT
  USING (sw_user_id = auth.uid() OR patient_user_id = auth.uid());
DROP POLICY IF EXISTS "DM participants can send messages" ON public.sw_direct_messages;
CREATE POLICY "DM participants can send messages" ON public.sw_direct_messages FOR INSERT
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
DROP POLICY IF EXISTS "DM participants can mark read" ON public.sw_direct_messages;
CREATE POLICY "DM participants can mark read" ON public.sw_direct_messages FOR UPDATE
  USING (sw_user_id = auth.uid() OR patient_user_id = auth.uid());
DROP POLICY IF EXISTS "Staff see all DMs" ON public.sw_direct_messages;
CREATE POLICY "Staff see all DMs" ON public.sw_direct_messages FOR ALL
  USING (public.is_staff());

-- Extend notification types for SW messaging
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'status_change','document_request','renewal_reminder','deadline','general',
  'session_invite','session_starting',
  'sw_engagement_request','sw_engagement_accepted','sw_engagement_rejected',
  'new_direct_message'
));
