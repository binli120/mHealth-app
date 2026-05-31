-- supabase/migrations/20260531000001_insurance_history.sql

CREATE TABLE IF NOT EXISTS public.insurance_coverage_records (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coverage_year    INT           NOT NULL CHECK (coverage_year >= 1990 AND coverage_year <= 2100),
  plan_name        TEXT          NOT NULL,
  program_code     TEXT,
  premium_monthly  NUMERIC(10,2) CHECK (premium_monthly IS NULL OR premium_monthly >= 0),
  household_size   INT           CHECK (household_size IS NULL OR household_size >= 1),
  annual_income    NUMERIC(12,2) CHECK (annual_income IS NULL OR annual_income >= 0),
  fpl_percent      NUMERIC(6,2)  CHECK (fpl_percent IS NULL OR fpl_percent >= 0),
  source           TEXT          NOT NULL DEFAULT 'self_reported'
                   CHECK (source IN ('platform', 'self_reported', 'document_extracted')),
  application_id   UUID          REFERENCES public.applications(id) ON DELETE SET NULL,
  document_id      UUID          REFERENCES public.documents(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT insurance_coverage_records_user_year_key UNIQUE (user_id, coverage_year)
);

CREATE TABLE IF NOT EXISTS public.insurance_explanations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_record_id  UUID        NOT NULL REFERENCES public.insurance_coverage_records(id) ON DELETE CASCADE,
  prior_record_id     UUID        REFERENCES public.insurance_coverage_records(id) ON DELETE SET NULL,
  change_factors      JSONB       NOT NULL DEFAULT '{}',
  explanation_text    TEXT        NOT NULL,
  generated_by        TEXT        NOT NULL CHECK (generated_by IN ('rules', 'llm')),
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT insurance_explanations_coverage_record_id_key UNIQUE (coverage_record_id)
);

-- RLS
ALTER TABLE public.insurance_coverage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coverage_records"
  ON public.insurance_coverage_records
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_explanations"
  ON public.insurance_explanations
  FOR ALL USING (
    coverage_record_id IN (
      SELECT id FROM public.insurance_coverage_records WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_insurance_coverage_records_user_id
  ON public.insurance_coverage_records(user_id);
