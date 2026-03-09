BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS application_type TEXT,
  ADD COLUMN IF NOT EXISTS draft_state JSONB,
  ADD COLUMN IF NOT EXISTS draft_step INT,
  ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  ALTER TABLE public.applications
    ADD CONSTRAINT applications_draft_step_range_check
    CHECK (draft_step IS NULL OR (draft_step >= 1 AND draft_step <= 9));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_applications_application_type
  ON public.applications(application_type);

CREATE INDEX IF NOT EXISTS idx_applications_last_saved_at
  ON public.applications(last_saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_draft_state
  ON public.applications USING GIN (draft_state);

UPDATE public.applications
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_applications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_applications_updated_at ON public.applications;
CREATE TRIGGER trg_touch_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_applications_updated_at();

COMMIT;
