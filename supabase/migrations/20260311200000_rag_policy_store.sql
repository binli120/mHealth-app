-- RAG Policy Document Store
-- Requires pgvector extension (enable via Supabase Dashboard → Extensions → vector)
-- Run AFTER enabling pgvector in your Supabase project

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Policy Documents ──────────────────────────────────────────────────────────
-- One row per source document (idempotent by source_url)

CREATE TABLE IF NOT EXISTS policy_documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  source_url  TEXT        NOT NULL UNIQUE,
  doc_type    TEXT        NOT NULL,  -- 'member_booklet' | 'eligibility_guide' | 'verifications' | 'transmittal'
  language    TEXT        NOT NULL DEFAULT 'en',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  chunk_count INT         NOT NULL DEFAULT 0
);

-- ── Policy Chunks ─────────────────────────────────────────────────────────────
-- One row per text chunk; embedding is 768-dim (nomic-embed-text)

CREATE TABLE IF NOT EXISTS policy_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  chunk_index INT         NOT NULL,
  content     TEXT        NOT NULL,
  embedding   vector(768),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IVFFlat index for fast approximate nearest-neighbor cosine search.
-- lists=50 is appropriate for up to ~50k chunks; increase to 100 for larger corpora.
CREATE INDEX IF NOT EXISTS idx_policy_chunks_embedding
  ON policy_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_policy_chunks_document_id
  ON policy_chunks(document_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policy documents are read-only for all authenticated users;
-- writes are done server-side via service role (ingest route uses getDbPool()).

ALTER TABLE policy_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_chunks        ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all policy data (it's public policy content)
CREATE POLICY policy_documents_read ON policy_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY policy_chunks_read ON policy_chunks
  FOR SELECT TO authenticated USING (true);

-- Only service role (server) can write — no authenticated-user write policies needed
-- (ingest route bypasses RLS using service-role key or getDbPool with superuser)
