-- Chat / Ollama request log
-- Run this migration once against your database.

CREATE TABLE IF NOT EXISTS public.chat_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  mode       TEXT,                                     -- masshealth | benefit_advisor | form_assistant | intake
  model      TEXT        NOT NULL DEFAULT 'llama3.2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON public.chat_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id    ON public.chat_logs(user_id);
