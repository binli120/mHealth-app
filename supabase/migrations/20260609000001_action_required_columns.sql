-- Migration: add SW-modified tracking columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS needs_customer_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sw_last_modified_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_applications_needs_review
  ON public.applications(applicant_id)
  WHERE needs_customer_review = true;

COMMENT ON COLUMN public.applications.needs_customer_review IS
  'Set true when a social worker modifies draft data. Cleared when the customer confirms.';
COMMENT ON COLUMN public.applications.sw_last_modified_at IS
  'Timestamp of the last social-worker-initiated save on this application.';
