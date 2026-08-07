-- Keep the customer personal-data presence check bounded as communication tables grow.
CREATE INDEX IF NOT EXISTS idx_session_messages_sender_id
  ON public.session_messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_help_questions_user_id
  ON public.help_questions (user_id);
