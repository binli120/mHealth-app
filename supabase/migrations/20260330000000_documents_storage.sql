-- Documents Storage migration — extends documents table for Supabase Storage
-- @author Bin Lee

ALTER TABLE public.documents ALTER COLUMN file_url DROP NOT NULL;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_name               TEXT,
  ADD COLUMN IF NOT EXISTS file_path               TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes         BIGINT,
  ADD COLUMN IF NOT EXISTS document_status         TEXT NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS required_document_label TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_status_check' AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_status_check
        CHECK (document_status IN ('uploaded', 'pending_review', 'verified', 'rejected'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_documents_status             ON public.documents (document_status);
CREATE INDEX IF NOT EXISTS idx_documents_application_status ON public.documents (application_id, document_status);
CREATE INDEX IF NOT EXISTS idx_documents_file_path          ON public.documents (file_path) WHERE file_path IS NOT NULL;
