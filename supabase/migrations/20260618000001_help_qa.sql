-- supabase/migrations/20260618000001_help_qa.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Questions table
CREATE TABLE public.help_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (char_length(title) >= 5 AND char_length(title) <= 300),
  body            text CHECK (char_length(body) <= 5000),
  category        text NOT NULL DEFAULT 'other'
                  CHECK (category IN ('eligibility','benefits_coverage','applications_appeals','platform_help','other')),
  embedding       vector(768),
  voice_url       text,
  voice_file_name text,
  file_url        text,
  file_name       text,
  notify_on_answer boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Answers table
CREATE TABLE public.help_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.help_questions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 5000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes: fuzzy search
CREATE INDEX help_questions_title_trgm ON public.help_questions USING gin (title gin_trgm_ops);
CREATE INDEX help_questions_body_trgm  ON public.help_questions USING gin (body  gin_trgm_ops);

-- Index: semantic similarity (hnsw works with 0 rows, unlike ivfflat)
CREATE INDEX help_questions_embedding_hnsw
  ON public.help_questions
  USING hnsw (embedding vector_cosine_ops);

-- Index: answers by question
CREATE INDEX help_answers_question_id ON public.help_answers (question_id, created_at);

-- Badge view (server-side only — never expose as a client claim)
CREATE OR REPLACE VIEW public.help_user_badge AS
SELECT
  u.id AS user_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id AND r.name = 'admin'
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id
        AND r.name IN ('social_worker','reviewer','case_reviewer','supervisor')
    ) THEN 'professional'
    ELSE NULL
  END AS badge_type
FROM auth.users u;

-- RLS
ALTER TABLE public.help_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_answers   ENABLE ROW LEVEL SECURITY;

-- Questions: anyone authenticated can read; authenticated can insert their own; owner or admin can delete
CREATE POLICY "help_questions_select" ON public.help_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "help_questions_insert" ON public.help_questions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "help_questions_delete" ON public.help_questions
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Answers: same pattern
CREATE POLICY "help_answers_select" ON public.help_answers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "help_answers_insert" ON public.help_answers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "help_answers_delete" ON public.help_answers
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Rate-limit rows for help Q&A (used by DbRateLimiter via rate_limit_counters table)
-- No insert needed — DbRateLimiter auto-creates rows on first use.
-- Seed comment only:
-- Key pattern: "help_question:{userId}" — 5/hr
-- Key pattern: "help_answer:{userId}"   — 20/hr
