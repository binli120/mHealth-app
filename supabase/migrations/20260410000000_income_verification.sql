-- ---------------------------------------------------------------------------
-- Income Verification Subsystem
-- Migration: 20260410000000_income_verification.sql
--
-- Adds document-backed income verification tables.  incomeVerified on the
-- application is derived from income_verification_decisions, not from
-- self-reported form fields.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. income_verification_cases
--    One row per application. Tracks aggregate verification state.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_verification_cases (
  application_id          UUID        PRIMARY KEY
                          REFERENCES public.applications (id) ON DELETE CASCADE,
  status                  TEXT        NOT NULL DEFAULT 'pending_documents'
                          CHECK (status IN (
                            'pending_documents', 'in_review', 'verified',
                            'rfi_sent', 'manual_review'
                          )),
  required_source_count   INT         NOT NULL DEFAULT 0,
  verified_source_count   INT         NOT NULL DEFAULT 0,
  decision_reason         TEXT,
  income_verified         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ivc_status
  ON public.income_verification_cases (status);

-- ---------------------------------------------------------------------------
-- 2. income_evidence_requirements
--    Per-member, per-source document requirements.
--    Built from household income data captured during intake.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_evidence_requirements (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL
                      REFERENCES public.applications (id) ON DELETE CASCADE,
  member_id           UUID        NOT NULL,
  member_name         TEXT        NOT NULL,
  income_source_type  TEXT        NOT NULL,
  accepted_doc_types  TEXT[]      NOT NULL DEFAULT '{}',
  is_required         BOOLEAN     NOT NULL DEFAULT TRUE,
  verification_status TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (verification_status IN (
                        'verified', 'needs_clarification',
                        'needs_additional_document', 'manual_review',
                        'attested_pending_review', 'pending'
                      )),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, member_id, income_source_type)
);

CREATE INDEX IF NOT EXISTS idx_ier_application_id
  ON public.income_evidence_requirements (application_id);
CREATE INDEX IF NOT EXISTS idx_ier_member_id
  ON public.income_evidence_requirements (application_id, member_id);

-- ---------------------------------------------------------------------------
-- 3. income_documents
--    Files uploaded per income source, separate from the general documents
--    table so they carry income-specific metadata.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL
                      REFERENCES public.applications (id) ON DELETE CASCADE,
  member_id           UUID        NOT NULL,
  doc_type_claimed    TEXT        NOT NULL,
  storage_key         TEXT        NOT NULL,
  mime_type           TEXT        NOT NULL,
  file_name           TEXT,
  file_size_bytes     BIGINT,
  extraction_status   TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (extraction_status IN (
                        'pending', 'processing', 'complete', 'failed'
                      )),
  job_id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  uploaded_by         UUID        REFERENCES public.users (id),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idoc_application_id
  ON public.income_documents (application_id);
CREATE INDEX IF NOT EXISTS idx_idoc_member_id
  ON public.income_documents (application_id, member_id);
CREATE INDEX IF NOT EXISTS idx_idoc_extraction_status
  ON public.income_documents (extraction_status)
  WHERE extraction_status IN ('pending', 'processing');

-- ---------------------------------------------------------------------------
-- 4. income_document_extractions
--    LLM/OCR output for each income document.
--    Confidence, extracted fields, model version.
--    The model must not decide legal sufficiency — the engine does.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_document_extractions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID        NOT NULL
                      REFERENCES public.income_documents (id) ON DELETE CASCADE,
  doc_type            TEXT,
  issuer              TEXT,
  person_name         TEXT,
  employer_name       TEXT,
  date_range_start    DATE,
  date_range_end      DATE,
  gross_amount        NUMERIC(12, 2),
  net_amount          NUMERIC(12, 2),
  frequency           TEXT        CHECK (frequency IN (
                        'weekly', 'biweekly', 'semimonthly',
                        'monthly', 'annual'
                      )),
  income_source_type  TEXT,
  confidence          NUMERIC(4, 3) NOT NULL DEFAULT 0
                      CHECK (confidence >= 0 AND confidence <= 1),
  needs_manual_review BOOLEAN     NOT NULL DEFAULT FALSE,
  reasons             TEXT[]      NOT NULL DEFAULT '{}',
  model_version       TEXT        NOT NULL DEFAULT 'unknown',
  raw_model_output    JSONB,
  extracted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_ide_document_id
  ON public.income_document_extractions (document_id);
CREATE INDEX IF NOT EXISTS idx_ide_confidence
  ON public.income_document_extractions (confidence);

-- ---------------------------------------------------------------------------
-- 5. income_verification_decisions
--    Per-member, per-source final decisions (engine or reviewer).
--    Only "verified" here makes the source count toward incomeVerified.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_verification_decisions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL
                      REFERENCES public.applications (id) ON DELETE CASCADE,
  member_id           UUID        NOT NULL,
  source_type         TEXT        NOT NULL,
  status              TEXT        NOT NULL
                      CHECK (status IN (
                        'verified', 'needs_clarification',
                        'needs_additional_document', 'manual_review',
                        'attested_pending_review', 'pending'
                      )),
  matched_amount      NUMERIC(12, 2),
  matched_frequency   TEXT,
  reviewer_id         UUID        REFERENCES public.users (id),
  reason_code         TEXT        NOT NULL DEFAULT 'auto',
  decided_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, member_id, source_type)
);

CREATE INDEX IF NOT EXISTS idx_ivd_application_id
  ON public.income_verification_decisions (application_id);

-- ---------------------------------------------------------------------------
-- 6. income_rfi_events
--    RFI records sent to applicants requesting missing income proof.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_rfi_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL
                      REFERENCES public.applications (id) ON DELETE CASCADE,
  reason_code         TEXT        NOT NULL,
  requested_docs      TEXT[]      NOT NULL DEFAULT '{}',
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ,
  created_by          UUID        REFERENCES public.users (id)
);

CREATE INDEX IF NOT EXISTS idx_irfi_application_id
  ON public.income_rfi_events (application_id);

-- ---------------------------------------------------------------------------
-- 7. updated_at trigger (shared pattern from existing schema)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_ivc_updated_at'
  ) THEN
    CREATE TRIGGER set_ivc_updated_at
      BEFORE UPDATE ON public.income_verification_cases
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_ier_updated_at'
  ) THEN
    CREATE TRIGGER set_ier_updated_at
      BEFORE UPDATE ON public.income_evidence_requirements
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
--    Applicants see only their own application data.
--    Staff (is_staff()) see everything.
-- ---------------------------------------------------------------------------
ALTER TABLE public.income_verification_cases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_evidence_requirements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_document_extractions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_verification_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_rfi_events             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applicant_read_ivc" ON public.income_verification_cases;
DROP POLICY IF EXISTS "applicant_read_ier" ON public.income_evidence_requirements;
DROP POLICY IF EXISTS "applicant_read_idoc" ON public.income_documents;
DROP POLICY IF EXISTS "applicant_insert_idoc" ON public.income_documents;
DROP POLICY IF EXISTS "staff_all_ivc" ON public.income_verification_cases;
DROP POLICY IF EXISTS "staff_all_ier" ON public.income_evidence_requirements;
DROP POLICY IF EXISTS "staff_all_idoc" ON public.income_documents;
DROP POLICY IF EXISTS "staff_all_ide" ON public.income_document_extractions;
DROP POLICY IF EXISTS "staff_all_ivd" ON public.income_verification_decisions;
DROP POLICY IF EXISTS "staff_all_irfi" ON public.income_rfi_events;
DROP POLICY IF EXISTS "applicant_read_irfi" ON public.income_rfi_events;
DROP POLICY IF EXISTS "applicant_read_ivd" ON public.income_verification_decisions;
DROP POLICY IF EXISTS "applicant_read_ide" ON public.income_document_extractions;

-- Applicant read access (via application ownership)
CREATE POLICY "applicant_read_ivc" ON public.income_verification_cases
  FOR SELECT USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );

CREATE POLICY "applicant_read_ier" ON public.income_evidence_requirements
  FOR SELECT USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );

CREATE POLICY "applicant_read_idoc" ON public.income_documents
  FOR SELECT USING (
    is_staff() OR uploaded_by = request_user_id() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );

CREATE POLICY "applicant_insert_idoc" ON public.income_documents
  FOR INSERT WITH CHECK (
    uploaded_by = request_user_id() AND EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );

CREATE POLICY "staff_all_ivc"  ON public.income_verification_cases     FOR ALL USING (is_staff());
CREATE POLICY "staff_all_ier"  ON public.income_evidence_requirements  FOR ALL USING (is_staff());
CREATE POLICY "staff_all_idoc" ON public.income_documents              FOR ALL USING (is_staff());
CREATE POLICY "staff_all_ide"  ON public.income_document_extractions   FOR ALL USING (is_staff());
CREATE POLICY "staff_all_ivd"  ON public.income_verification_decisions FOR ALL USING (is_staff());
CREATE POLICY "staff_all_irfi" ON public.income_rfi_events             FOR ALL USING (is_staff());

-- Applicants read their own RFI events and extraction results
CREATE POLICY "applicant_read_irfi" ON public.income_rfi_events
  FOR SELECT USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );

CREATE POLICY "applicant_read_ivd" ON public.income_verification_decisions
  FOR SELECT USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = application_id AND ap.user_id = request_user_id()
    )
  );

CREATE POLICY "applicant_read_ide" ON public.income_document_extractions
  FOR SELECT USING (
    is_staff() OR EXISTS (
      SELECT 1 FROM public.income_documents idoc
      JOIN public.applications a ON a.id = idoc.application_id
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE idoc.id = document_id AND ap.user_id = request_user_id()
    )
  );
