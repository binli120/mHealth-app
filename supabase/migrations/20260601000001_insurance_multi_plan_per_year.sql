-- Allow multiple insurance plans per coverage year per user.
-- Patients can be dual-eligible (Medicare + MassHealth) or carry employer
-- insurance alongside a secondary plan in the same year.

ALTER TABLE public.insurance_coverage_records
  DROP CONSTRAINT IF EXISTS insurance_coverage_records_user_year_key;

-- New unique constraint: one row per (user, year, plan_name) so the same
-- plan cannot be entered twice for the same year.
ALTER TABLE public.insurance_coverage_records
  ADD CONSTRAINT insurance_coverage_records_user_year_plan_key
  UNIQUE (user_id, coverage_year, plan_name);
