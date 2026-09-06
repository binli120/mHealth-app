-- =============================================================================
-- Migration: feature_flags, feature_flag_env_overrides, and appeal-assistant
-- RAG source tables (mh_appeal_source_documents, mh_appeal_source_chunks,
-- mh_denial_patterns)
--
-- These 5 tables existed on the dev database with no corresponding migration
-- file anywhere in this directory (created by hand via the dashboard/SQL
-- editor at some point). Discovered 2026-09-04 while provisioning the prod
-- Supabase project from this migrations directory — `apply_migration` on
-- 20260623000008_rls_policies_missing.sql failed because it creates policies
-- referencing tables that never existed on a fresh install.
--
-- Schema reconstructed from dev's live information_schema / pg_constraint /
-- pg_indexes (ref tkhgeqydxxsuyrhavbeg). Placed with a timestamp just before
-- 20260623000008 so a fresh `supabase db reset` creates these tables before
-- that file's policies reference them.
--
-- Idempotent: each guarded CREATE is a no-op on dev / existing installs.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE,
  label       TEXT        NOT NULL,
  description TEXT,
  enabled     BOOLEAN     NOT NULL DEFAULT true,
  category    TEXT        NOT NULL DEFAULT 'general',
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feature_flag_env_overrides (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id     UUID        NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  environment TEXT        NOT NULL,
  enabled     BOOLEAN     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flag_id, environment)
);

CREATE TABLE IF NOT EXISTS public.mh_appeal_source_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key       TEXT        NOT NULL UNIQUE,
  title            TEXT        NOT NULL,
  source_url       TEXT        NOT NULL,
  source_type      TEXT        NOT NULL,
  trust_tier       TEXT        NOT NULL CHECK (trust_tier IN ('official','legal_aid','community')),
  issue_categories JSONB       NOT NULL DEFAULT '[]',
  program_tags     JSONB       NOT NULL DEFAULT '[]',
  summary          TEXT        NOT NULL,
  raw_text         TEXT        NOT NULL,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mh_appeal_source_documents_trust
  ON public.mh_appeal_source_documents(trust_tier, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mh_appeal_source_chunks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id  UUID        NOT NULL REFERENCES public.mh_appeal_source_documents(id) ON DELETE CASCADE,
  chunk_index         INT         NOT NULL,
  content             TEXT        NOT NULL,
  token_count         INT,
  embedding           vector(768),
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_mh_appeal_source_chunks_document
  ON public.mh_appeal_source_chunks(source_document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_mh_appeal_source_chunks_embedding
  ON public.mh_appeal_source_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS public.mh_denial_patterns (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code           TEXT        NOT NULL UNIQUE,
  label                   TEXT        NOT NULL,
  description             TEXT        NOT NULL,
  denial_category         TEXT        NOT NULL CHECK (denial_category IN (
                            'income','assets','missing_verification','residency',
                            'citizenship_immigration','disability','prior_authorization',
                            'renewal_termination','procedural'
                          )),
  notice_keywords         JSONB       NOT NULL DEFAULT '[]',
  evidence_needed         JSONB       NOT NULL DEFAULT '[]',
  argument_themes         JSONB       NOT NULL DEFAULT '[]',
  missing_info_questions  JSONB       NOT NULL DEFAULT '[]',
  regulatory_citations    JSONB       NOT NULL DEFAULT '[]',
  metadata                JSONB       NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mh_denial_patterns_category
  ON public.mh_denial_patterns(denial_category);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_env_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mh_appeal_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mh_appeal_source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mh_denial_patterns ENABLE ROW LEVEL SECURITY;

COMMIT;
