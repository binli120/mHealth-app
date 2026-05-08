-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Document validation/artifact metadata for server-side OCR analysis.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS analysis_document_type TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS validation_error TEXT,
  ADD COLUMN IF NOT EXISTS validation_summary JSONB,
  ADD COLUMN IF NOT EXISTS validation_certificate JSONB,
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_validation_status_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_validation_status_check
    CHECK (validation_status IN (
      'not_required',
      'pending',
      'analyzing',
      'valid',
      'invalid',
      'error'
    ));

CREATE INDEX IF NOT EXISTS idx_documents_validation_status
  ON public.documents (validation_status);

CREATE INDEX IF NOT EXISTS idx_documents_application_validation_status
  ON public.documents (application_id, validation_status);
