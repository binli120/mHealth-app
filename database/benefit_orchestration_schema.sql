-- Cross-Program Benefit Orchestration Schema
-- Family profiles (standalone, reusable across multiple applications)
-- Benefit stack results (evaluation outputs)

-- ── family_profiles ───────────────────────────────────────────────────────────
-- One active profile per applicant, stored as JSONB for schema flexibility
-- (benefit program rules change annually; JSONB allows evolution without migrations)

CREATE TABLE IF NOT EXISTS family_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_id)  -- one active profile per applicant
);

CREATE INDEX IF NOT EXISTS idx_family_profiles_applicant_id ON family_profiles(applicant_id);
CREATE INDEX IF NOT EXISTS idx_family_profiles_updated ON family_profiles(updated_at DESC);

-- Trigger to auto-update updated_at on upsert
CREATE OR REPLACE FUNCTION public.update_family_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_profiles_updated_at ON family_profiles;
CREATE TRIGGER family_profiles_updated_at
  BEFORE UPDATE ON family_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_family_profile_updated_at();

-- ── benefit_stack_results ─────────────────────────────────────────────────────
-- Persisted evaluation outputs; history kept for analytics / auditability
-- Most recent result is the active one

CREATE TABLE IF NOT EXISTS benefit_stack_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_profile_id UUID NOT NULL REFERENCES family_profiles(id) ON DELETE CASCADE,
  stack_data JSONB NOT NULL,  -- full BenefitStack object
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_profile ON benefit_stack_results(family_profile_id);
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_generated ON benefit_stack_results(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_json ON benefit_stack_results USING GIN (stack_data);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_stack_results ENABLE ROW LEVEL SECURITY;

-- family_profiles: owner can read/write; staff can access all
CREATE POLICY family_profiles_owner_rw
  ON public.family_profiles
  FOR ALL
  TO authenticated
  USING (public.can_access_applicant(applicant_id))
  WITH CHECK (public.can_access_applicant(applicant_id));

-- benefit_stack_results: owner can read their own results; staff can access all
CREATE POLICY benefit_stack_results_owner_select
  ON public.benefit_stack_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_profiles fp
      WHERE fp.id = family_profile_id
        AND public.can_access_applicant(fp.applicant_id)
    )
  );

CREATE POLICY benefit_stack_results_owner_insert
  ON public.benefit_stack_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.family_profiles fp
      WHERE fp.id = family_profile_id
        AND public.can_access_applicant(fp.applicant_id)
    )
  );

CREATE POLICY benefit_stack_results_staff_all
  ON public.benefit_stack_results
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
