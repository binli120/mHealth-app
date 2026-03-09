BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_applications_id_trgm
  ON public.applications
  USING GIN ((id::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_applications_application_type_trgm
  ON public.applications
  USING GIN (application_type gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_applications_applicant_name_trgm
  ON public.applications
  USING GIN ((COALESCE(draft_state #>> '{data,contact,p1_name}', '')) gin_trgm_ops);

COMMIT;
