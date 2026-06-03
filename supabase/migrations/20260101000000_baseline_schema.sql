-- =============================================================================
-- Baseline Schema — synthesized from 43 incremental migrations
-- @author: Bin Lee <blee@healthcompass.cloud>
--
-- Covers migrations:
--   20260301133000 through 20260528100000
--
-- Apply with: supabase db reset   (fresh install)
--             psql -f this_file   (idempotent re-run)
-- =============================================================================

BEGIN;

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Custom types ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'application_status'
  ) THEN
    CREATE TYPE application_status AS ENUM (
      'draft',
      'submitted',
      'ai_extracted',
      'needs_review',
      'rfi_requested',
      'approved',
      'denied'
    );
  END IF;
END $$;

-- ── Core helper functions (needed before RLS policies) ────────────────────────

CREATE OR REPLACE FUNCTION public.request_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Final is_staff() — includes all four staff roles
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = public.request_user_id()
      AND r.name IN ('admin', 'reviewer', 'supervisor', 'read_only_staff')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id = public.request_user_id() OR public.is_staff()
$$;

CREATE OR REPLACE FUNCTION public.can_access_applicant(p_applicant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.applicants ap
      WHERE ap.id = p_applicant_id
        AND ap.user_id = public.request_user_id()
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_application(p_application_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = p_application_id
        AND ap.user_id = public.request_user_id()
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_document(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = p_document_id
        AND public.can_access_application(d.application_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_organization(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = public.request_user_id()
        AND u.organization_id = p_organization_id
    )
$$;

-- ── Tables ────────────────────────────────────────────────────────────────────
-- (ordered by FK dependency)

CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id          SERIAL  PRIMARY KEY,
  name        TEXT    UNIQUE NOT NULL,
  description TEXT,
  color       TEXT    NOT NULL DEFAULT '#6b7280',
  is_system   BOOLEAN NOT NULL DEFAULT false
);

-- companies is declared without the approved_by FK to avoid circular dependency
-- (companies.approved_by → users, users.company_id → companies).
-- The FK is added after both tables exist.
CREATE TABLE IF NOT EXISTS public.companies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  npi          TEXT,
  address      TEXT,
  city         TEXT,
  state        TEXT,
  zip          TEXT,
  phone        TEXT,
  email_domain TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at  TIMESTAMPTZ,
  approved_by  UUID        -- FK added below after users exists
);

-- users references organizations and companies
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id),
  company_id      UUID        REFERENCES public.companies(id) ON DELETE SET NULL,
  email           TEXT        UNIQUE NOT NULL,
  password_hash   TEXT        NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  avatar_url      TEXT,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add companies.approved_by → users FK now that users exists
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_approved_by_fkey;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES public.users(id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id INT  NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- applicants: final state — no plaintext PHI columns
CREATE TABLE IF NOT EXISTS public.applicants (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        UNIQUE REFERENCES public.users(id),
  -- Encrypted PHI columns (AES-256-GCM, app-layer encryption)
  first_name_encrypted  TEXT,
  last_name_encrypted   TEXT,
  dob_encrypted         TEXT,
  phone_encrypted       TEXT,
  address_line1_encrypted TEXT,
  address_line2_encrypted TEXT,
  city_encrypted        TEXT,
  state_encrypted       TEXT,
  zip_encrypted         TEXT,
  -- Still plaintext (non-PHI classification fields)
  ssn_encrypted         TEXT,
  dob                   DATE,
  citizenship_status    TEXT,
  -- Identity verification fields
  identity_status       TEXT        NOT NULL DEFAULT 'unverified'
    CHECK (identity_status IN ('unverified', 'pending', 'verified', 'failed')),
  identity_verified_at  TIMESTAMPTZ,
  identity_provider     TEXT        DEFAULT 'dl_barcode',
  identity_score        SMALLINT,
  dl_number_hash        TEXT,
  dl_expiration_date    DATE,
  dl_issuing_state      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.applications (
  id                   UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID               REFERENCES public.organizations(id),
  applicant_id         UUID               REFERENCES public.applicants(id),
  status               application_status NOT NULL DEFAULT 'draft',
  application_type     TEXT,
  household_size       INT                CHECK (household_size IS NULL OR household_size >= 1),
  total_monthly_income NUMERIC(12,2)      CHECK (total_monthly_income IS NULL OR total_monthly_income >= 0),
  confidence_score     NUMERIC(5,2)       CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
  draft_state          JSONB,
  draft_step           INT                CHECK (draft_step IS NULL OR (draft_step >= 1 AND draft_step <= 9)),
  last_saved_at        TIMESTAMPTZ,
  -- PHI draft resume
  phi_draft_resume_id  UUID,
  phi_draft_key_enc    TEXT,
  submitted_at         TIMESTAMPTZ,
  decided_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ        NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ        NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID    NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  first_name     TEXT,
  last_name      TEXT,
  dob            DATE,
  relationship   TEXT,
  pregnant       BOOLEAN NOT NULL DEFAULT false,
  disabled       BOOLEAN NOT NULL DEFAULT false,
  over_65        BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT household_members_id_application_id_key UNIQUE (id, application_id)
);

CREATE TABLE IF NOT EXISTS public.incomes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  member_id      UUID        REFERENCES public.household_members(id),
  income_type    TEXT,
  employer_name  TEXT,
  monthly_amount NUMERIC(12,2) CHECK (monthly_amount IS NULL OR monthly_amount >= 0),
  verified       BOOLEAN     NOT NULL DEFAULT false,
  CONSTRAINT incomes_member_application_fk
    FOREIGN KEY (member_id, application_id) REFERENCES public.household_members(id, application_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.assets (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  asset_type     TEXT,
  value          NUMERIC(14,2) CHECK (value IS NULL OR value >= 0)
);

CREATE TABLE IF NOT EXISTS public.documents (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id           UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  uploaded_by              UUID        REFERENCES public.users(id),
  document_type            TEXT,
  file_url                 TEXT,
  mime_type                TEXT,
  file_name                TEXT,
  file_path                TEXT,
  file_size_bytes          BIGINT,
  document_status          TEXT        NOT NULL DEFAULT 'uploaded'
    CONSTRAINT documents_status_check
      CHECK (document_status IN ('uploaded', 'pending_review', 'verified', 'rejected')),
  required_document_label  TEXT,
  thumbnail_path           TEXT,
  pdf_path                 TEXT,
  analysis_document_type   TEXT,
  validation_status        TEXT        NOT NULL DEFAULT 'not_required'
    CONSTRAINT documents_validation_status_check
      CHECK (validation_status IN ('not_required','pending','analyzing','valid','invalid','error')),
  validation_error         TEXT,
  validation_summary       JSONB,
  validation_certificate   JSONB,
  analyzed_at              TIMESTAMPTZ,
  uploaded_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_pages (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID    NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page_number INT     CHECK (page_number IS NULL OR page_number > 0),
  ocr_text    TEXT,
  CONSTRAINT document_pages_document_id_page_number_key UNIQUE (document_id, page_number)
);

CREATE TABLE IF NOT EXISTS public.document_extractions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  model_name       TEXT,
  raw_output       JSONB,
  structured_output JSONB,
  confidence_score NUMERIC(5,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
  extracted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.validation_results (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  rule_name      TEXT,
  severity       TEXT        CHECK (severity IS NULL OR severity IN ('warning', 'error')),
  message        TEXT,
  resolved       BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eligibility_screenings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  estimated_program TEXT,
  fpl_percentage    NUMERIC(6,2) CHECK (fpl_percentage IS NULL OR fpl_percentage >= 0),
  screening_result  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.review_actions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        REFERENCES public.applications(id),
  reviewer_id    UUID        REFERENCES public.users(id),
  action_type    TEXT        CHECK (action_type IS NULL OR action_type IN ('approve', 'deny', 'rfi')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rfis (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        REFERENCES public.applications(id),
  requested_by   UUID        REFERENCES public.users(id),
  message        TEXT,
  due_date       DATE,
  resolved       BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES public.users(id),
  application_id UUID        REFERENCES public.applications(id) ON DELETE SET NULL,
  action         TEXT,
  old_data       JSONB,
  new_data       JSONB,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RAG policy store (requires pgvector)
CREATE TABLE IF NOT EXISTS public.policy_documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  source_url  TEXT        NOT NULL UNIQUE,
  doc_type    TEXT        NOT NULL,
  language    TEXT        NOT NULL DEFAULT 'en',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  chunk_count INT         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.policy_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL REFERENCES public.policy_documents(id) ON DELETE CASCADE,
  chunk_index INT         NOT NULL,
  content     TEXT        NOT NULL,
  embedding   vector(768),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Collaborative sessions
CREATE TABLE IF NOT EXISTS public.collaborative_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sw_user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  ended_by         UUID        REFERENCES auth.users(id),
  invite_message   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.session_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES public.collaborative_sessions(id) ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL DEFAULT 'text'
    CHECK (type IN ('text', 'voice')),
  content      TEXT,
  storage_path TEXT,
  duration_sec INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Social worker profiles
CREATE TABLE IF NOT EXISTS public.social_worker_profiles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  company_id       UUID        NOT NULL REFERENCES public.companies(id),
  first_name       TEXT,
  last_name        TEXT,
  phone            TEXT,
  bio              TEXT,
  avatar_url       TEXT,
  license_number   TEXT,
  job_title        TEXT,
  accepting_patients BOOLEAN   NOT NULL DEFAULT true,
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_note   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at      TIMESTAMPTZ,
  approved_by      UUID        REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.patient_social_worker_access (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  social_worker_user_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at            TIMESTAMPTZ,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (patient_user_id, social_worker_user_id)
);

-- Notifications — final type constraint includes all types
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL
    CONSTRAINT notifications_type_check
      CHECK (type IN (
        'status_change','document_request','renewal_reminder','deadline','general',
        'session_invite','session_starting',
        'sw_engagement_request','sw_engagement_accepted','sw_engagement_rejected',
        'new_direct_message'
      )),
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  read_at       TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  company_id  UUID        REFERENCES public.companies(id) ON DELETE SET NULL,
  role        TEXT        NOT NULL DEFAULT 'applicant',
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User profiles (applicant-facing profile / bank data)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  profile_data JSONB       NOT NULL DEFAULT '{}',
  bank_data    JSONB       NOT NULL DEFAULT '{}',
  avatar_url   TEXT        DEFAULT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_id)
);

-- Benefit orchestration
CREATE TABLE IF NOT EXISTS public.family_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  profile_data JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_id)
);

CREATE TABLE IF NOT EXISTS public.benefit_stack_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_profile_id UUID        NOT NULL REFERENCES public.family_profiles(id) ON DELETE CASCADE,
  stack_data        JSONB       NOT NULL,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SW messaging
CREATE TABLE IF NOT EXISTS public.sw_engagement_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sw_user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  patient_message  TEXT,
  rejection_note   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sw_direct_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sw_user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_type    TEXT        NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'voice', 'image')),
  content         TEXT,
  storage_path    TEXT,
  duration_sec    INTEGER,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Identity verification
CREATE TABLE IF NOT EXISTS public.identity_verification_attempts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id       UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status             TEXT        NOT NULL CHECK (status IN ('verified', 'needs_review', 'failed')),
  score              SMALLINT    NOT NULL,
  breakdown          JSONB       NOT NULL DEFAULT '{}',
  dl_number_hash     TEXT,
  dl_expiration_date DATE,
  dl_issuing_state   TEXT,
  is_expired         BOOLEAN     NOT NULL DEFAULT false,
  attempted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address         TEXT,
  user_agent         TEXT
);

-- Cross-device mobile verify sessions
CREATE TABLE IF NOT EXISTS public.mobile_verify_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token            TEXT        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  applicant_id     UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  verify_status    TEXT        CHECK (verify_status IN ('verified', 'needs_review', 'failed')),
  verify_score     SMALLINT,
  verify_breakdown JSONB,
  extracted_data   JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '10 minutes',
  completed_at     TIMESTAMPTZ
);

-- Income verification subsystem
CREATE TABLE IF NOT EXISTS public.income_verification_cases (
  application_id        UUID        PRIMARY KEY
                        REFERENCES public.applications(id) ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'pending_documents'
    CHECK (status IN (
      'pending_documents','in_review','verified','rfi_sent','manual_review'
    )),
  required_source_count INT         NOT NULL DEFAULT 0,
  verified_source_count INT         NOT NULL DEFAULT 0,
  decision_reason       TEXT,
  income_verified       BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.income_evidence_requirements (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  member_id           UUID        NOT NULL,
  member_name         TEXT        NOT NULL,
  income_source_type  TEXT        NOT NULL,
  accepted_doc_types  TEXT[]      NOT NULL DEFAULT '{}',
  is_required         BOOLEAN     NOT NULL DEFAULT true,
  verification_status TEXT        NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN (
      'verified','needs_clarification','needs_additional_document',
      'manual_review','attested_pending_review','pending'
    )),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, member_id, income_source_type)
);

CREATE TABLE IF NOT EXISTS public.income_documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  member_id         UUID        NOT NULL,
  doc_type_claimed  TEXT        NOT NULL,
  storage_key       TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL,
  file_name         TEXT,
  file_size_bytes   BIGINT,
  extraction_status TEXT        NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending','processing','complete','failed')),
  job_id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  uploaded_by       UUID        REFERENCES public.users(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.income_document_extractions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID        NOT NULL REFERENCES public.income_documents(id) ON DELETE CASCADE,
  doc_type            TEXT,
  issuer              TEXT,
  person_name         TEXT,
  employer_name       TEXT,
  date_range_start    DATE,
  date_range_end      DATE,
  gross_amount        NUMERIC(12,2),
  net_amount          NUMERIC(12,2),
  frequency           TEXT        CHECK (frequency IN ('weekly','biweekly','semimonthly','monthly','annual')),
  income_source_type  TEXT,
  confidence          NUMERIC(4,3) NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  needs_manual_review BOOLEAN     NOT NULL DEFAULT false,
  reasons             TEXT[]      NOT NULL DEFAULT '{}',
  model_version       TEXT        NOT NULL DEFAULT 'unknown',
  raw_model_output    JSONB,
  extracted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id)
);

CREATE TABLE IF NOT EXISTS public.income_verification_decisions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  member_id      UUID        NOT NULL,
  source_type    TEXT        NOT NULL,
  status         TEXT        NOT NULL
    CHECK (status IN (
      'verified','needs_clarification','needs_additional_document',
      'manual_review','attested_pending_review','pending'
    )),
  matched_amount    NUMERIC(12,2),
  matched_frequency TEXT,
  reviewer_id       UUID        REFERENCES public.users(id),
  reason_code       TEXT        NOT NULL DEFAULT 'auto',
  decided_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, member_id, source_type)
);

CREATE TABLE IF NOT EXISTS public.income_rfi_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  reason_code    TEXT        NOT NULL,
  requested_docs TEXT[]      NOT NULL DEFAULT '{}',
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ,
  created_by     UUID        REFERENCES public.users(id)
);

-- Revoked sessions
CREATE TABLE IF NOT EXISTS public.revoked_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  token_hash TEXT,
  reason     TEXT        NOT NULL DEFAULT 'manual_revocation',
  revoked_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  CONSTRAINT revoked_sessions_subject_check
    CHECK (user_id IS NOT NULL OR session_id IS NOT NULL OR token_hash IS NOT NULL),
  CONSTRAINT revoked_sessions_token_hash_check
    CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE public.revoked_sessions IS
  'Revoked access-token sessions. Rows may target an exact token hash, a Supabase session_id/sid/jti claim, or all tokens for a user issued before revoked_at.';

-- Admin passkey credentials
CREATE TABLE IF NOT EXISTS public.admin_passkey_credentials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,
  public_key    TEXT        NOT NULL,
  counter       BIGINT      NOT NULL DEFAULT 0,
  transports    TEXT[]      NOT NULL DEFAULT '{}',
  device_type   TEXT        NOT NULL,
  backed_up     BOOLEAN     NOT NULL DEFAULT false,
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

-- Growth system
CREATE TABLE IF NOT EXISTS public.growth_referrals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT        NOT NULL,
  landing_path  TEXT        NOT NULL,
  referrer      TEXT,
  campaign      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  user_agent    TEXT,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mailing_list_signups (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL,
  source          TEXT        NOT NULL DEFAULT 'landing-page',
  referral_code   TEXT,
  campaign        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  user_agent      TEXT,
  ip_hash         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  CONSTRAINT mailing_list_signups_email_unique UNIQUE (email),
  CONSTRAINT mailing_list_signups_email_lower_check CHECK (email = lower(email))
);

-- Role permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name   TEXT    NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
  permission  TEXT    NOT NULL,
  UNIQUE (role_name, permission)
);

-- Login events
CREATE TABLE IF NOT EXISTS public.login_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL DEFAULT 'login',
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cross-device mobile upload sessions
CREATE TABLE IF NOT EXISTS public.mobile_upload_sessions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token                  TEXT        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  user_id                UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  application_id         UUID        NOT NULL,
  document_type          TEXT,
  required_document_label TEXT,
  status                 TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired')),
  document_id            UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at             TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '15 minutes',
  completed_at           TIMESTAMPTZ
);

-- User passkey credentials (all authenticated users)
CREATE TABLE IF NOT EXISTS public.user_passkey_credentials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,
  public_key    TEXT        NOT NULL,
  counter       BIGINT      NOT NULL DEFAULT 0,
  transports    TEXT[]      NOT NULL DEFAULT '{}',
  device_type   TEXT        NOT NULL DEFAULT 'singleDevice',
  backed_up     BOOLEAN     NOT NULL DEFAULT false,
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

-- Appeal analyses cache
CREATE TABLE IF NOT EXISTS public.appeal_analyses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL,
  denial_reason_id  TEXT        NOT NULL,
  input_hash        TEXT        NOT NULL,
  explanation       TEXT        NOT NULL DEFAULT '',
  appeal_letter     TEXT        NOT NULL DEFAULT '',
  evidence_checklist JSONB      NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_appeal_analysis UNIQUE (user_id, denial_reason_id, input_hash)
);

-- User agent memory (ReAct pipeline)
CREATE TABLE IF NOT EXISTS public.user_agent_memory (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL UNIQUE,
  session_id      TEXT,
  extracted_facts JSONB       NOT NULL DEFAULT '{}',
  form_progress   JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate limit counters
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 1,
  CONSTRAINT rate_limit_counters_pkey PRIMARY KEY (key, window_start)
);

COMMENT ON TABLE public.rate_limit_counters IS
  'Shared rate-limit window counters. Written by DbRateLimiter (lib/server/rate-limit.ts). '
  'Purged periodically by purge_expired_rate_limit_counters().';

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- organizations
-- (no extra indexes beyond PK)

-- users
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);

-- roles / user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- applicants
CREATE INDEX IF NOT EXISTS idx_applicants_user_id          ON public.applicants(user_id);
CREATE INDEX IF NOT EXISTS idx_applicants_identity_status  ON public.applicants(identity_status);

-- applications
CREATE INDEX IF NOT EXISTS idx_application_status            ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_organization_id  ON public.applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id     ON public.applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_application_type ON public.applications(application_type);
CREATE INDEX IF NOT EXISTS idx_applications_last_saved_at    ON public.applications(last_saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_draft_state      ON public.applications USING GIN (draft_state);
-- trigram indexes for search
CREATE INDEX IF NOT EXISTS idx_applications_id_trgm
  ON public.applications USING GIN ((id::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_applications_application_type_trgm
  ON public.applications USING GIN (application_type gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_name_trgm
  ON public.applications USING GIN ((COALESCE(draft_state #>> '{data,contact,p1_name}', '')) gin_trgm_ops);

-- household_members
CREATE INDEX IF NOT EXISTS idx_household_members_application_id ON public.household_members(application_id);

-- incomes
CREATE INDEX IF NOT EXISTS idx_incomes_application_id ON public.incomes(application_id);
CREATE INDEX IF NOT EXISTS idx_incomes_member_id      ON public.incomes(member_id);

-- assets
CREATE INDEX IF NOT EXISTS idx_assets_application_id ON public.assets(application_id);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_application             ON public.documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by             ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_status                  ON public.documents(document_status);
CREATE INDEX IF NOT EXISTS idx_documents_application_status      ON public.documents(application_id, document_status);
CREATE INDEX IF NOT EXISTS idx_documents_file_path               ON public.documents(file_path) WHERE file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_validation_status       ON public.documents(validation_status);
CREATE INDEX IF NOT EXISTS idx_documents_application_validation_status
  ON public.documents(application_id, validation_status);

-- document_pages
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON public.document_pages(document_id);

-- document_extractions
CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON public.document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_extraction_json ON public.document_extractions USING GIN (structured_output);

-- validation_results
CREATE INDEX IF NOT EXISTS idx_validation_application ON public.validation_results(application_id);

-- eligibility_screenings
CREATE INDEX IF NOT EXISTS idx_eligibility_screenings_application_id ON public.eligibility_screenings(application_id);

-- review_actions
CREATE INDEX IF NOT EXISTS idx_review_actions_application_id ON public.review_actions(application_id);
CREATE INDEX IF NOT EXISTS idx_review_actions_reviewer_id    ON public.review_actions(reviewer_id);

-- rfis
CREATE INDEX IF NOT EXISTS idx_rfis_application_id ON public.rfis(application_id);
CREATE INDEX IF NOT EXISTS idx_rfis_requested_by   ON public.rfis(requested_by);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_application  ON public.audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- policy_chunks
CREATE INDEX IF NOT EXISTS idx_policy_chunks_embedding
  ON public.policy_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_policy_chunks_document_id ON public.policy_chunks(document_id);

-- collaborative_sessions
CREATE INDEX IF NOT EXISTS idx_sessions_sw       ON public.collaborative_sessions(sw_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_patient  ON public.collaborative_sessions(patient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_status   ON public.collaborative_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_ended_by ON public.collaborative_sessions(ended_by) WHERE ended_by IS NOT NULL;

-- session_messages
CREATE INDEX IF NOT EXISTS idx_session_msgs_session ON public.session_messages(session_id, created_at);

-- companies
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);

-- social_worker_profiles
CREATE INDEX IF NOT EXISTS idx_sw_profiles_user      ON public.social_worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_company   ON public.social_worker_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_status    ON public.social_worker_profiles(status);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_name      ON public.social_worker_profiles(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_accepting ON public.social_worker_profiles(accepting_patients)
  WHERE accepting_patients = true;

-- patient_social_worker_access
CREATE INDEX IF NOT EXISTS idx_sw_access_patient ON public.patient_social_worker_access(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_access_sw      ON public.patient_social_worker_access(social_worker_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_access_active  ON public.patient_social_worker_access(is_active);

-- notifications
CREATE INDEX IF NOT EXISTS notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread  ON public.notifications(user_id) WHERE read_at IS NULL;

-- invitations
CREATE INDEX IF NOT EXISTS idx_invitations_token      ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email      ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_company_id ON public.invitations(company_id);

-- user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_applicant_id ON public.user_profiles(applicant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated      ON public.user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_json         ON public.user_profiles USING GIN (profile_data);

-- family_profiles
CREATE INDEX IF NOT EXISTS idx_family_profiles_applicant_id ON public.family_profiles(applicant_id);
CREATE INDEX IF NOT EXISTS idx_family_profiles_updated      ON public.family_profiles(updated_at DESC);

-- benefit_stack_results
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_profile   ON public.benefit_stack_results(family_profile_id);
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_generated ON public.benefit_stack_results(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_json      ON public.benefit_stack_results USING GIN (stack_data);

-- sw_engagement_requests
CREATE UNIQUE INDEX IF NOT EXISTS sw_engagement_requests_active_uq
  ON public.sw_engagement_requests(patient_user_id, sw_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS sw_engagement_requests_patient_idx
  ON public.sw_engagement_requests(patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_engagement_requests_sw_idx
  ON public.sw_engagement_requests(sw_user_id, status, created_at DESC);

-- sw_direct_messages
CREATE INDEX IF NOT EXISTS sw_direct_messages_thread_idx ON public.sw_direct_messages(sw_user_id, patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_direct_messages_sender_idx ON public.sw_direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_direct_messages_unread_idx ON public.sw_direct_messages(sw_user_id, patient_user_id) WHERE read_at IS NULL;

-- identity_verification_attempts
CREATE INDEX IF NOT EXISTS idx_identity_attempts_applicant ON public.identity_verification_attempts(applicant_id);
CREATE INDEX IF NOT EXISTS idx_identity_attempts_user      ON public.identity_verification_attempts(user_id);

-- mobile_verify_sessions
CREATE INDEX IF NOT EXISTS idx_mobile_verify_sessions_token ON public.mobile_verify_sessions(token);
CREATE INDEX IF NOT EXISTS idx_mobile_verify_sessions_user  ON public.mobile_verify_sessions(user_id, status);

-- income_verification_cases
CREATE INDEX IF NOT EXISTS idx_ivc_status ON public.income_verification_cases(status);

-- income_evidence_requirements
CREATE INDEX IF NOT EXISTS idx_ier_application_id ON public.income_evidence_requirements(application_id);
CREATE INDEX IF NOT EXISTS idx_ier_member_id      ON public.income_evidence_requirements(application_id, member_id);

-- income_documents
CREATE INDEX IF NOT EXISTS idx_idoc_application_id    ON public.income_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_idoc_member_id         ON public.income_documents(application_id, member_id);
CREATE INDEX IF NOT EXISTS idx_idoc_extraction_status ON public.income_documents(extraction_status)
  WHERE extraction_status IN ('pending', 'processing');

-- income_document_extractions
CREATE INDEX IF NOT EXISTS idx_ide_document_id ON public.income_document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_ide_confidence  ON public.income_document_extractions(confidence);

-- income_verification_decisions
CREATE INDEX IF NOT EXISTS idx_ivd_application_id ON public.income_verification_decisions(application_id);

-- income_rfi_events
CREATE INDEX IF NOT EXISTS idx_irfi_application_id ON public.income_rfi_events(application_id);

-- revoked_sessions
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_user_active
  ON public.revoked_sessions(user_id, revoked_at DESC);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_session_active
  ON public.revoked_sessions(session_id) WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_revoked_sessions_token_hash
  ON public.revoked_sessions(token_hash) WHERE token_hash IS NOT NULL;

-- admin_passkey_credentials
CREATE INDEX IF NOT EXISTS idx_admin_passkey_credentials_user_id ON public.admin_passkey_credentials(user_id);

-- growth system
CREATE INDEX IF NOT EXISTS idx_growth_referrals_code_created  ON public.growth_referrals(referral_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_referrals_campaign_gin  ON public.growth_referrals USING GIN (campaign);
CREATE INDEX IF NOT EXISTS idx_mailing_list_signups_created   ON public.mailing_list_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailing_list_signups_referral  ON public.mailing_list_signups(referral_code)
  WHERE referral_code IS NOT NULL;

-- role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_name);

-- login_events
CREATE INDEX IF NOT EXISTS idx_login_events_user_id    ON public.login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON public.login_events(created_at);

-- mobile_upload_sessions
CREATE INDEX IF NOT EXISTS idx_mobile_upload_sessions_token ON public.mobile_upload_sessions(token);
CREATE INDEX IF NOT EXISTS idx_mobile_upload_sessions_user  ON public.mobile_upload_sessions(user_id, status);

-- user_passkey_credentials
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON public.user_passkey_credentials(user_id);

-- appeal_analyses
CREATE INDEX IF NOT EXISTS idx_appeal_analyses_lookup ON public.appeal_analyses(user_id, denial_reason_id, input_hash);

-- user_agent_memory
CREATE INDEX IF NOT EXISTS idx_user_agent_memory_user_id ON public.user_agent_memory(user_id);

-- rate_limit_counters
CREATE INDEX IF NOT EXISTS rate_limit_counters_window_start_idx ON public.rate_limit_counters(window_start);

-- ── Functions & Triggers ──────────────────────────────────────────────────────

-- Generic set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- applications updated_at
CREATE OR REPLACE FUNCTION public.touch_applications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

-- collaborative_sessions updated_at
CREATE OR REPLACE FUNCTION public.set_session_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_updated_at ON public.collaborative_sessions;
CREATE TRIGGER trg_session_updated_at
  BEFORE UPDATE ON public.collaborative_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_session_updated_at();

-- user_profiles updated_at
CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_user_profile_updated_at();

-- family_profiles updated_at
CREATE OR REPLACE FUNCTION public.update_family_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS family_profiles_updated_at ON public.family_profiles;
CREATE TRIGGER family_profiles_updated_at
  BEFORE UPDATE ON public.family_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_family_profile_updated_at();

-- sw_engagement_requests updated_at
CREATE OR REPLACE FUNCTION public.set_sw_request_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS sw_engagement_requests_updated_at ON public.sw_engagement_requests;
CREATE TRIGGER sw_engagement_requests_updated_at
  BEFORE UPDATE ON public.sw_engagement_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_sw_request_updated_at();

-- income_verification_cases updated_at
DROP TRIGGER IF EXISTS set_ivc_updated_at ON public.income_verification_cases;
CREATE TRIGGER set_ivc_updated_at
  BEFORE UPDATE ON public.income_verification_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- income_evidence_requirements updated_at
DROP TRIGGER IF EXISTS set_ier_updated_at ON public.income_evidence_requirements;
CREATE TRIGGER set_ier_updated_at
  BEFORE UPDATE ON public.income_evidence_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auth user sync trigger — final version (no plaintext PHI columns)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  INSERT INTO public.users (id, email, password_hash, is_active, created_at)
  VALUES (NEW.id, NEW.email, 'supabase_auth_managed', true, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, is_active = true;

  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'patient');

  IF v_role NOT IN ('social_worker', 'admin', 'reviewer') THEN
    INSERT INTO public.applicants (user_id, created_at)
    VALUES (NEW.id, COALESCE(NEW.created_at, now()))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- handle_new_user (alias kept for backward compatibility)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.applicants (user_id, created_at)
  VALUES (NEW.id, now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Role exclusivity enforcement
CREATE OR REPLACE FUNCTION public.check_admin_social_worker_exclusivity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  incoming_role_name TEXT;
  conflicting_role   TEXT;
BEGIN
  SELECT name INTO incoming_role_name FROM public.roles WHERE id = NEW.role_id;

  IF incoming_role_name NOT IN ('admin', 'social_worker') THEN
    RETURN NEW;
  END IF;

  conflicting_role := CASE incoming_role_name
    WHEN 'admin'         THEN 'social_worker'
    WHEN 'social_worker' THEN 'admin'
  END;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = NEW.user_id AND r.name = conflicting_role
  ) THEN
    RAISE EXCEPTION
      'Role conflict: a user cannot hold both "admin" and "social_worker" roles simultaneously. '
      'Remove the "%" role first.', conflicting_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_social_worker_exclusivity ON public.user_roles;
CREATE TRIGGER trg_enforce_admin_social_worker_exclusivity
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.check_admin_social_worker_exclusivity();

-- Rate limit purge function
CREATE OR REPLACE FUNCTION public.purge_expired_rate_limit_counters()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.rate_limit_counters
  WHERE window_start < (now() - interval '2 hours');
$$;

-- ── Views ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.identity_pending_review WITH (security_invoker = true) AS
  SELECT
    a.id              AS applicant_id,
    a.identity_status,
    a.identity_score,
    a.dl_expiration_date,
    a.dl_issuing_state,
    iva.attempted_at  AS last_attempt_at,
    iva.breakdown
  FROM public.applicants a
  LEFT JOIN LATERAL (
    SELECT breakdown, attempted_at
    FROM public.identity_verification_attempts
    WHERE applicant_id = a.id
    ORDER BY attempted_at DESC LIMIT 1
  ) iva ON TRUE
  WHERE a.identity_status IN ('pending', 'failed');

-- ── Enable Row Level Security ─────────────────────────────────────────────────

ALTER TABLE public.organizations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicants                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extractions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_results          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eligibility_screenings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_actions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfis                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_chunks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborative_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_worker_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_social_worker_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_stack_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sw_engagement_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sw_direct_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_verify_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_verification_cases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_evidence_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_verification_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_rfi_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revoked_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_passkey_credentials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_referrals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailing_list_signups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_upload_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_passkey_credentials    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeal_analyses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_agent_memory           ENABLE ROW LEVEL SECURITY;
-- rate_limit_counters: server-only; RLS enabled with no permissive policies so
-- only service-role (which bypasses RLS) can read/write.
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──────────────────────────────────────────────────────────────

-- organizations
DROP POLICY IF EXISTS organizations_select       ON public.organizations;
DROP POLICY IF EXISTS organizations_write_staff  ON public.organizations;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated
  USING (public.can_access_organization(id));
CREATE POLICY organizations_write_staff ON public.organizations FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- users
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
  USING (public.can_access_user(id));
CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated
  USING (public.can_access_user(id)) WITH CHECK (public.can_access_user(id));

-- roles
DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated USING (true);

-- user_roles
DROP POLICY IF EXISTS user_roles_select      ON public.user_roles;
DROP POLICY IF EXISTS user_roles_write_staff ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (public.can_access_user(user_id));
CREATE POLICY user_roles_write_staff ON public.user_roles FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- applicants
DROP POLICY IF EXISTS applicants_select ON public.applicants;
DROP POLICY IF EXISTS applicants_insert ON public.applicants;
DROP POLICY IF EXISTS applicants_update ON public.applicants;
CREATE POLICY applicants_select ON public.applicants FOR SELECT TO authenticated
  USING (public.can_access_user(user_id));
CREATE POLICY applicants_insert ON public.applicants FOR INSERT TO authenticated
  WITH CHECK (public.can_access_user(user_id));
CREATE POLICY applicants_update ON public.applicants FOR UPDATE TO authenticated
  USING (public.can_access_user(user_id)) WITH CHECK (public.can_access_user(user_id));

-- applications
DROP POLICY IF EXISTS applications_select ON public.applications;
DROP POLICY IF EXISTS applications_insert ON public.applications;
DROP POLICY IF EXISTS applications_update ON public.applications;
DROP POLICY IF EXISTS applications_delete ON public.applications;
CREATE POLICY applications_select ON public.applications FOR SELECT TO authenticated
  USING (public.can_access_application(id));
CREATE POLICY applications_insert ON public.applications FOR INSERT TO authenticated
  WITH CHECK (public.can_access_applicant(applicant_id));
CREATE POLICY applications_update ON public.applications FOR UPDATE TO authenticated
  USING (public.can_access_application(id))
  WITH CHECK (public.can_access_applicant(applicant_id));
CREATE POLICY applications_delete ON public.applications FOR DELETE TO authenticated
  USING (public.can_access_application(id));

-- household_members
DROP POLICY IF EXISTS household_members_owner_rw ON public.household_members;
CREATE POLICY household_members_owner_rw ON public.household_members FOR ALL TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

-- incomes
DROP POLICY IF EXISTS incomes_owner_rw ON public.incomes;
CREATE POLICY incomes_owner_rw ON public.incomes FOR ALL TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

-- assets
DROP POLICY IF EXISTS assets_owner_rw ON public.assets;
CREATE POLICY assets_owner_rw ON public.assets FOR ALL TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

-- documents
DROP POLICY IF EXISTS documents_select ON public.documents;
DROP POLICY IF EXISTS documents_insert ON public.documents;
DROP POLICY IF EXISTS documents_update ON public.documents;
DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_application(application_id)
    AND (uploaded_by IS NULL OR public.can_access_user(uploaded_by))
  );
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (
    public.can_access_application(application_id)
    AND (uploaded_by IS NULL OR public.can_access_user(uploaded_by))
  );
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated
  USING (public.can_access_application(application_id));

-- document_pages
DROP POLICY IF EXISTS document_pages_select      ON public.document_pages;
DROP POLICY IF EXISTS document_pages_write_staff ON public.document_pages;
CREATE POLICY document_pages_select ON public.document_pages FOR SELECT TO authenticated
  USING (public.can_access_document(document_id));
CREATE POLICY document_pages_write_staff ON public.document_pages FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- document_extractions
DROP POLICY IF EXISTS document_extractions_select      ON public.document_extractions;
DROP POLICY IF EXISTS document_extractions_write_staff ON public.document_extractions;
CREATE POLICY document_extractions_select ON public.document_extractions FOR SELECT TO authenticated
  USING (public.can_access_document(document_id));
CREATE POLICY document_extractions_write_staff ON public.document_extractions FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- validation_results
DROP POLICY IF EXISTS validation_results_select      ON public.validation_results;
DROP POLICY IF EXISTS validation_results_write_staff ON public.validation_results;
CREATE POLICY validation_results_select ON public.validation_results FOR SELECT TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY validation_results_write_staff ON public.validation_results FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- eligibility_screenings
DROP POLICY IF EXISTS eligibility_screenings_select      ON public.eligibility_screenings;
DROP POLICY IF EXISTS eligibility_screenings_write_staff ON public.eligibility_screenings;
CREATE POLICY eligibility_screenings_select ON public.eligibility_screenings FOR SELECT TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY eligibility_screenings_write_staff ON public.eligibility_screenings FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- review_actions
DROP POLICY IF EXISTS review_actions_select      ON public.review_actions;
DROP POLICY IF EXISTS review_actions_write_staff ON public.review_actions;
CREATE POLICY review_actions_select ON public.review_actions FOR SELECT TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY review_actions_write_staff ON public.review_actions FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- rfis
DROP POLICY IF EXISTS rfis_select      ON public.rfis;
DROP POLICY IF EXISTS rfis_write_staff ON public.rfis;
CREATE POLICY rfis_select ON public.rfis FOR SELECT TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY rfis_write_staff ON public.rfis FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- audit_logs
DROP POLICY IF EXISTS audit_logs_select      ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_write_staff ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (public.can_access_user(user_id));
CREATE POLICY audit_logs_write_staff ON public.audit_logs FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- policy_documents / policy_chunks
DROP POLICY IF EXISTS policy_documents_read ON public.policy_documents;
DROP POLICY IF EXISTS policy_chunks_read    ON public.policy_chunks;
CREATE POLICY policy_documents_read ON public.policy_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY policy_chunks_read    ON public.policy_chunks    FOR SELECT TO authenticated USING (true);

-- collaborative_sessions
DROP POLICY IF EXISTS sessions_select ON public.collaborative_sessions;
DROP POLICY IF EXISTS sessions_insert ON public.collaborative_sessions;
DROP POLICY IF EXISTS sessions_update ON public.collaborative_sessions;
CREATE POLICY sessions_select ON public.collaborative_sessions FOR SELECT TO authenticated
  USING (
    sw_user_id = public.request_user_id()
    OR patient_user_id = public.request_user_id()
    OR public.is_staff()
  );
-- Hardened insert: SW must have an active access relationship with the patient
CREATE POLICY sessions_insert ON public.collaborative_sessions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    OR (
      sw_user_id = public.request_user_id()
      AND EXISTS (
        SELECT 1 FROM public.patient_social_worker_access psa
        WHERE psa.patient_user_id = collaborative_sessions.patient_user_id
          AND psa.social_worker_user_id = collaborative_sessions.sw_user_id
          AND psa.is_active = true
      )
    )
  );
CREATE POLICY sessions_update ON public.collaborative_sessions FOR UPDATE TO authenticated
  USING (
    sw_user_id = public.request_user_id()
    OR patient_user_id = public.request_user_id()
    OR public.is_staff()
  )
  WITH CHECK (
    sw_user_id = public.request_user_id()
    OR patient_user_id = public.request_user_id()
    OR public.is_staff()
  );

-- session_messages
DROP POLICY IF EXISTS session_msgs_select ON public.session_messages;
DROP POLICY IF EXISTS session_msgs_insert ON public.session_messages;
CREATE POLICY session_msgs_select ON public.session_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborative_sessions s
      WHERE s.id = session_id
        AND (s.sw_user_id = public.request_user_id() OR s.patient_user_id = public.request_user_id())
    )
    OR public.is_staff()
  );
CREATE POLICY session_msgs_insert ON public.session_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.request_user_id()
    AND EXISTS (
      SELECT 1 FROM public.collaborative_sessions s
      WHERE s.id = session_id
        AND s.status = 'active'
        AND (s.sw_user_id = public.request_user_id() OR s.patient_user_id = public.request_user_id())
    )
  );

-- companies
DROP POLICY IF EXISTS companies_select_approved ON public.companies;
DROP POLICY IF EXISTS companies_write_staff     ON public.companies;
CREATE POLICY companies_select_approved ON public.companies FOR SELECT TO authenticated
  USING (status = 'approved' OR public.is_staff());
CREATE POLICY companies_write_staff ON public.companies FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- social_worker_profiles
DROP POLICY IF EXISTS sw_profiles_select              ON public.social_worker_profiles;
DROP POLICY IF EXISTS sw_profiles_insert              ON public.social_worker_profiles;
DROP POLICY IF EXISTS sw_profiles_update              ON public.social_worker_profiles;
DROP POLICY IF EXISTS sw_profiles_update_self_accepting ON public.social_worker_profiles;
CREATE POLICY sw_profiles_select ON public.social_worker_profiles FOR SELECT TO authenticated
  USING (user_id = public.request_user_id() OR public.is_staff());
CREATE POLICY sw_profiles_insert ON public.social_worker_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = public.request_user_id() OR public.is_staff());
CREATE POLICY sw_profiles_update ON public.social_worker_profiles FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
-- SW can flip their own accepting_patients flag
CREATE POLICY sw_profiles_update_self_accepting ON public.social_worker_profiles FOR UPDATE TO authenticated
  USING (user_id = public.request_user_id())
  WITH CHECK (user_id = public.request_user_id());

-- patient_social_worker_access
DROP POLICY IF EXISTS sw_access_select ON public.patient_social_worker_access;
DROP POLICY IF EXISTS sw_access_insert ON public.patient_social_worker_access;
DROP POLICY IF EXISTS sw_access_update ON public.patient_social_worker_access;
CREATE POLICY sw_access_select ON public.patient_social_worker_access FOR SELECT TO authenticated
  USING (
    patient_user_id = public.request_user_id()
    OR social_worker_user_id = public.request_user_id()
    OR public.is_staff()
  );
CREATE POLICY sw_access_insert ON public.patient_social_worker_access FOR INSERT TO authenticated
  WITH CHECK (patient_user_id = public.request_user_id() OR public.is_staff());
CREATE POLICY sw_access_update ON public.patient_social_worker_access FOR UPDATE TO authenticated
  USING (patient_user_id = public.request_user_id() OR public.is_staff())
  WITH CHECK (patient_user_id = public.request_user_id() OR public.is_staff());

-- notifications
DROP POLICY IF EXISTS users_own_notifications  ON public.notifications;
DROP POLICY IF EXISTS staff_all_notifications  ON public.notifications;
CREATE POLICY users_own_notifications ON public.notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY staff_all_notifications ON public.notifications FOR ALL USING (public.is_staff());

-- invitations
DROP POLICY IF EXISTS admins_manage_invitations ON public.invitations;
CREATE POLICY admins_manage_invitations ON public.invitations FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- user_profiles
DROP POLICY IF EXISTS user_profiles_owner_rw ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_staff_all ON public.user_profiles;
CREATE POLICY user_profiles_owner_rw ON public.user_profiles FOR ALL TO authenticated
  USING (public.can_access_applicant(applicant_id))
  WITH CHECK (public.can_access_applicant(applicant_id));
CREATE POLICY user_profiles_staff_all ON public.user_profiles FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- family_profiles
DROP POLICY IF EXISTS family_profiles_owner_rw ON public.family_profiles;
CREATE POLICY family_profiles_owner_rw ON public.family_profiles FOR ALL TO authenticated
  USING (public.can_access_applicant(applicant_id))
  WITH CHECK (public.can_access_applicant(applicant_id));

-- benefit_stack_results
DROP POLICY IF EXISTS benefit_stack_results_owner_select ON public.benefit_stack_results;
DROP POLICY IF EXISTS benefit_stack_results_owner_insert ON public.benefit_stack_results;
DROP POLICY IF EXISTS benefit_stack_results_staff_all    ON public.benefit_stack_results;
CREATE POLICY benefit_stack_results_owner_select ON public.benefit_stack_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.family_profiles fp
    WHERE fp.id = family_profile_id AND public.can_access_applicant(fp.applicant_id)
  ));
CREATE POLICY benefit_stack_results_owner_insert ON public.benefit_stack_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.family_profiles fp
    WHERE fp.id = family_profile_id AND public.can_access_applicant(fp.applicant_id)
  ));
CREATE POLICY benefit_stack_results_staff_all ON public.benefit_stack_results FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- sw_engagement_requests
DROP POLICY IF EXISTS "Patients see own engagement requests"    ON public.sw_engagement_requests;
DROP POLICY IF EXISTS "Patients create engagement requests"     ON public.sw_engagement_requests;
DROP POLICY IF EXISTS "Patients cancel own pending requests"    ON public.sw_engagement_requests;
DROP POLICY IF EXISTS "SWs see requests for them"               ON public.sw_engagement_requests;
DROP POLICY IF EXISTS "SWs respond to pending requests"         ON public.sw_engagement_requests;
DROP POLICY IF EXISTS "Staff see all engagement requests"       ON public.sw_engagement_requests;
CREATE POLICY "Patients see own engagement requests"    ON public.sw_engagement_requests FOR SELECT USING (patient_user_id = auth.uid());
CREATE POLICY "Patients create engagement requests"     ON public.sw_engagement_requests FOR INSERT WITH CHECK (patient_user_id = auth.uid());
CREATE POLICY "Patients cancel own pending requests"    ON public.sw_engagement_requests FOR UPDATE USING (patient_user_id = auth.uid() AND status = 'pending');
CREATE POLICY "SWs see requests for them"               ON public.sw_engagement_requests FOR SELECT USING (sw_user_id = auth.uid());
CREATE POLICY "SWs respond to pending requests"         ON public.sw_engagement_requests FOR UPDATE USING (sw_user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Staff see all engagement requests"       ON public.sw_engagement_requests FOR ALL   USING (public.is_staff());

-- sw_direct_messages
DROP POLICY IF EXISTS "DM participants can view messages" ON public.sw_direct_messages;
DROP POLICY IF EXISTS "DM participants can send messages" ON public.sw_direct_messages;
DROP POLICY IF EXISTS "DM participants can mark read"     ON public.sw_direct_messages;
DROP POLICY IF EXISTS "Staff see all DMs"                 ON public.sw_direct_messages;
CREATE POLICY "DM participants can view messages" ON public.sw_direct_messages FOR SELECT
  USING (sw_user_id = auth.uid() OR patient_user_id = auth.uid());
CREATE POLICY "DM participants can send messages" ON public.sw_direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (sw_user_id = auth.uid() OR patient_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.patient_social_worker_access psa
      WHERE psa.patient_user_id = sw_direct_messages.patient_user_id
        AND psa.social_worker_user_id = sw_direct_messages.sw_user_id
        AND psa.is_active = true
    )
  );
CREATE POLICY "DM participants can mark read" ON public.sw_direct_messages FOR UPDATE
  USING (sw_user_id = auth.uid() OR patient_user_id = auth.uid());
CREATE POLICY "Staff see all DMs" ON public.sw_direct_messages FOR ALL USING (public.is_staff());

-- identity_verification_attempts
DROP POLICY IF EXISTS identity_attempts_owner_select ON public.identity_verification_attempts;
DROP POLICY IF EXISTS identity_attempts_staff_all    ON public.identity_verification_attempts;
CREATE POLICY identity_attempts_owner_select ON public.identity_verification_attempts FOR SELECT
  USING (public.can_access_applicant(applicant_id));
CREATE POLICY identity_attempts_staff_all    ON public.identity_verification_attempts FOR ALL
  USING (public.is_staff());

-- mobile_verify_sessions
DROP POLICY IF EXISTS mobile_sessions_owner ON public.mobile_verify_sessions;
DROP POLICY IF EXISTS mobile_sessions_staff ON public.mobile_verify_sessions;
CREATE POLICY mobile_sessions_owner ON public.mobile_verify_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY mobile_sessions_staff ON public.mobile_verify_sessions FOR ALL USING (public.is_staff());

-- income_verification_cases
DROP POLICY IF EXISTS "applicant_read_ivc" ON public.income_verification_cases;
DROP POLICY IF EXISTS "staff_all_ivc"      ON public.income_verification_cases;
CREATE POLICY "applicant_read_ivc" ON public.income_verification_cases FOR SELECT
  USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );
CREATE POLICY "staff_all_ivc" ON public.income_verification_cases FOR ALL USING (is_staff());

-- income_evidence_requirements
DROP POLICY IF EXISTS "applicant_read_ier" ON public.income_evidence_requirements;
DROP POLICY IF EXISTS "staff_all_ier"      ON public.income_evidence_requirements;
CREATE POLICY "applicant_read_ier" ON public.income_evidence_requirements FOR SELECT
  USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );
CREATE POLICY "staff_all_ier" ON public.income_evidence_requirements FOR ALL USING (is_staff());

-- income_documents
DROP POLICY IF EXISTS "applicant_read_idoc"   ON public.income_documents;
DROP POLICY IF EXISTS "applicant_insert_idoc" ON public.income_documents;
DROP POLICY IF EXISTS "staff_all_idoc"        ON public.income_documents;
CREATE POLICY "applicant_read_idoc" ON public.income_documents FOR SELECT
  USING (
    is_staff() OR uploaded_by = request_user_id() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );
CREATE POLICY "applicant_insert_idoc" ON public.income_documents FOR INSERT
  WITH CHECK (
    uploaded_by = request_user_id() AND EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );
CREATE POLICY "staff_all_idoc" ON public.income_documents FOR ALL USING (is_staff());

-- income_document_extractions
DROP POLICY IF EXISTS "applicant_read_ide" ON public.income_document_extractions;
DROP POLICY IF EXISTS "staff_all_ide"      ON public.income_document_extractions;
CREATE POLICY "applicant_read_ide" ON public.income_document_extractions FOR SELECT
  USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.income_documents idoc
      JOIN public.applications a ON a.id = idoc.application_id
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE idoc.id = document_id AND ap.user_id = request_user_id()
    )
  );
CREATE POLICY "staff_all_ide" ON public.income_document_extractions FOR ALL USING (is_staff());

-- income_verification_decisions
DROP POLICY IF EXISTS "applicant_read_ivd" ON public.income_verification_decisions;
DROP POLICY IF EXISTS "staff_all_ivd"      ON public.income_verification_decisions;
CREATE POLICY "applicant_read_ivd" ON public.income_verification_decisions FOR SELECT
  USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );
CREATE POLICY "staff_all_ivd" ON public.income_verification_decisions FOR ALL USING (is_staff());

-- income_rfi_events
DROP POLICY IF EXISTS "applicant_read_irfi" ON public.income_rfi_events;
DROP POLICY IF EXISTS "staff_all_irfi"      ON public.income_rfi_events;
CREATE POLICY "applicant_read_irfi" ON public.income_rfi_events FOR SELECT
  USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );
CREATE POLICY "staff_all_irfi" ON public.income_rfi_events FOR ALL USING (is_staff());

-- revoked_sessions
DROP POLICY IF EXISTS revoked_sessions_staff_select ON public.revoked_sessions;
CREATE POLICY revoked_sessions_staff_select ON public.revoked_sessions FOR SELECT TO authenticated
  USING (public.is_staff());

-- admin_passkey_credentials
DROP POLICY IF EXISTS apc_select_own ON public.admin_passkey_credentials;
DROP POLICY IF EXISTS apc_insert_own ON public.admin_passkey_credentials;
DROP POLICY IF EXISTS apc_update_own ON public.admin_passkey_credentials;
DROP POLICY IF EXISTS apc_delete_own ON public.admin_passkey_credentials;
CREATE POLICY apc_select_own ON public.admin_passkey_credentials FOR SELECT TO authenticated
  USING (user_id = public.request_user_id());
CREATE POLICY apc_insert_own ON public.admin_passkey_credentials FOR INSERT TO authenticated
  WITH CHECK (user_id = public.request_user_id());
CREATE POLICY apc_update_own ON public.admin_passkey_credentials FOR UPDATE TO authenticated
  USING (user_id = public.request_user_id()) WITH CHECK (user_id = public.request_user_id());
CREATE POLICY apc_delete_own ON public.admin_passkey_credentials FOR DELETE TO authenticated
  USING (user_id = public.request_user_id());

-- role_permissions
DROP POLICY IF EXISTS rp_select_staff ON public.role_permissions;
CREATE POLICY rp_select_staff ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_staff());

-- login_events
DROP POLICY IF EXISTS le_select_own   ON public.login_events;
DROP POLICY IF EXISTS le_select_staff ON public.login_events;
CREATE POLICY le_select_own   ON public.login_events FOR SELECT TO authenticated
  USING (user_id = public.request_user_id());
CREATE POLICY le_select_staff ON public.login_events FOR SELECT TO authenticated
  USING (public.is_staff());

-- admin_settings
DROP POLICY IF EXISTS as_select_authenticated ON public.admin_settings;
CREATE POLICY as_select_authenticated ON public.admin_settings FOR SELECT TO authenticated
  USING (true);

-- growth_referrals
DROP POLICY IF EXISTS gr_insert_public ON public.growth_referrals;
DROP POLICY IF EXISTS gr_select_staff  ON public.growth_referrals;
CREATE POLICY gr_insert_public ON public.growth_referrals FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY gr_select_staff  ON public.growth_referrals FOR SELECT TO authenticated USING (public.is_staff());

-- mailing_list_signups
DROP POLICY IF EXISTS mls_insert_public ON public.mailing_list_signups;
DROP POLICY IF EXISTS mls_select_staff  ON public.mailing_list_signups;
CREATE POLICY mls_insert_public ON public.mailing_list_signups FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY mls_select_staff  ON public.mailing_list_signups FOR SELECT TO authenticated USING (public.is_staff());

-- mobile_upload_sessions
DROP POLICY IF EXISTS mobile_upload_sessions_owner ON public.mobile_upload_sessions;
DROP POLICY IF EXISTS mobile_upload_sessions_staff ON public.mobile_upload_sessions;
CREATE POLICY mobile_upload_sessions_owner ON public.mobile_upload_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY mobile_upload_sessions_staff ON public.mobile_upload_sessions FOR ALL USING (public.is_staff());

-- user_passkey_credentials
DROP POLICY IF EXISTS user_passkeys_select ON public.user_passkey_credentials;
DROP POLICY IF EXISTS user_passkeys_insert ON public.user_passkey_credentials;
DROP POLICY IF EXISTS user_passkeys_delete ON public.user_passkey_credentials;
CREATE POLICY user_passkeys_select ON public.user_passkey_credentials FOR SELECT TO authenticated
  USING (user_id = public.request_user_id() OR public.is_staff());
CREATE POLICY user_passkeys_insert ON public.user_passkey_credentials FOR INSERT TO authenticated
  WITH CHECK (user_id = public.request_user_id());
CREATE POLICY user_passkeys_delete ON public.user_passkey_credentials FOR DELETE TO authenticated
  USING (user_id = public.request_user_id());

-- appeal_analyses
DROP POLICY IF EXISTS "appeal_analyses_select_own" ON public.appeal_analyses;
DROP POLICY IF EXISTS "appeal_analyses_insert_own" ON public.appeal_analyses;
CREATE POLICY "appeal_analyses_select_own" ON public.appeal_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "appeal_analyses_insert_own" ON public.appeal_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_agent_memory
DROP POLICY IF EXISTS "agent_memory_owner" ON public.user_agent_memory;
DROP POLICY IF EXISTS "agent_memory_staff" ON public.user_agent_memory;
CREATE POLICY "agent_memory_owner" ON public.user_agent_memory FOR ALL USING (user_id = auth.uid()::text);
CREATE POLICY "agent_memory_staff" ON public.user_agent_memory FOR ALL USING (is_staff());

-- ── Storage policies (masshealth-dev bucket) ──────────────────────────────────

DROP POLICY IF EXISTS "masshealth_dev_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_read_own"   ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_staff_all"  ON storage.objects;

CREATE POLICY "masshealth_dev_upload_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "masshealth_dev_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "masshealth_dev_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "masshealth_dev_staff_all" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND public.is_staff()
  )
  WITH CHECK (
    bucket_id = 'masshealth-dev'
    AND public.is_staff()
  );

COMMIT;
