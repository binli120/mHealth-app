-- ============================================================
-- documents_storage_migration.sql
-- Extends the documents table for Supabase Storage integration.
-- Safe to re-run — all statements are idempotent.
--
-- NOTE: Supabase Storage bucket policies (storage.objects) CANNOT
-- be applied via plain psql because that table is owned by
-- supabase_storage_admin, not postgres.
-- Apply those separately via:
--   supabase/migrations/storage_policies.sql  (applied by `supabase db push`)
-- or the Supabase Dashboard → Storage → Policies.
-- ============================================================

-- 1. Relax the NOT NULL on file_url — file_path (storage object path)
--    is now the canonical reference; file_url is kept for compatibility.
ALTER TABLE public.documents
  ALTER COLUMN file_url DROP NOT NULL;

-- 2. Add Supabase Storage–specific columns (all IF NOT EXISTS)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_name              TEXT,
  ADD COLUMN IF NOT EXISTS file_path              TEXT,     -- {userId}/{applicationId}/{docId}/{fileName}
  ADD COLUMN IF NOT EXISTS file_size_bytes        BIGINT,
  ADD COLUMN IF NOT EXISTS document_status        TEXT NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS required_document_label TEXT;   -- e.g. "MA Driver's License"

-- 3. Add status constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_status_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_status_check
        CHECK (document_status IN ('uploaded', 'pending_review', 'verified', 'rejected'));
  END IF;
END;
$$;

-- 4. Indexes (all IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_documents_status
  ON public.documents (document_status);

CREATE INDEX IF NOT EXISTS idx_documents_application_status
  ON public.documents (application_id, document_status);

CREATE INDEX IF NOT EXISTS idx_documents_file_path
  ON public.documents (file_path)
  WHERE file_path IS NOT NULL;
