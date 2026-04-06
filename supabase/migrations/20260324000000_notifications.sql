-- Notifications table
-- @author Bin Lee

CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN (
                              'status_change','document_request','renewal_reminder',
                              'deadline','general'
                            )),
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  read_at       TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread  ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_notifications ON public.notifications;
CREATE POLICY users_own_notifications ON public.notifications FOR ALL
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS staff_all_notifications ON public.notifications;
CREATE POLICY staff_all_notifications ON public.notifications FOR ALL
  USING (public.is_staff());
