-- ── Notifications ──────────────────────────────────────────────────────────────
-- Stores in-app and email notifications for users.
-- Run after user_profile_schema.sql (depends on auth.users).

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN (
                                'status_change',
                                'document_request',
                                'renewal_reminder',
                                'deadline',
                                'general'
                              )),
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  read_at         TIMESTAMPTZ,
  email_sent_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup: user's notifications newest-first
CREATE INDEX IF NOT EXISTS notifications_user_created
  ON notifications (user_id, created_at DESC);

-- Partial index for unread count queries
CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id)
  WHERE read_at IS NULL;

-- RLS: users see only their own rows; staff see all
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_notifications"
  ON notifications
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "staff_all_notifications"
  ON notifications
  FOR ALL
  USING (is_staff());
