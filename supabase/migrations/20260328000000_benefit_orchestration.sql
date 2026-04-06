-- Benefit Orchestration Schema — depends on applicants (20260301)
-- @author Bin Lee

CREATE TABLE IF NOT EXISTS public.family_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  profile_data JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_family_profiles_applicant_id ON public.family_profiles(applicant_id);
CREATE INDEX IF NOT EXISTS idx_family_profiles_updated      ON public.family_profiles(updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_family_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS family_profiles_updated_at ON public.family_profiles;
CREATE TRIGGER family_profiles_updated_at
  BEFORE UPDATE ON public.family_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_family_profile_updated_at();

CREATE TABLE IF NOT EXISTS public.benefit_stack_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_profile_id UUID        NOT NULL REFERENCES public.family_profiles(id) ON DELETE CASCADE,
  stack_data        JSONB       NOT NULL,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_profile   ON public.benefit_stack_results(family_profile_id);
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_generated ON public.benefit_stack_results(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_json      ON public.benefit_stack_results USING GIN (stack_data);

ALTER TABLE public.family_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_stack_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_profiles_owner_rw ON public.family_profiles;
CREATE POLICY family_profiles_owner_rw ON public.family_profiles FOR ALL TO authenticated
  USING  (public.can_access_applicant(applicant_id))
  WITH CHECK (public.can_access_applicant(applicant_id));

DROP POLICY IF EXISTS benefit_stack_results_owner_select ON public.benefit_stack_results;
CREATE POLICY benefit_stack_results_owner_select ON public.benefit_stack_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.family_profiles fp
    WHERE fp.id = family_profile_id AND public.can_access_applicant(fp.applicant_id)
  ));
DROP POLICY IF EXISTS benefit_stack_results_owner_insert ON public.benefit_stack_results;
CREATE POLICY benefit_stack_results_owner_insert ON public.benefit_stack_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.family_profiles fp
    WHERE fp.id = family_profile_id AND public.can_access_applicant(fp.applicant_id)
  ));
DROP POLICY IF EXISTS benefit_stack_results_staff_all ON public.benefit_stack_results;
CREATE POLICY benefit_stack_results_staff_all ON public.benefit_stack_results FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
