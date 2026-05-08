-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'application_status'
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

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  first_name TEXT,
  last_name TEXT,
  dob DATE,
  ssn_encrypted TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  citizenship_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  applicant_id UUID REFERENCES applicants(id),
  status application_status NOT NULL DEFAULT 'draft',
  household_size INT,
  total_monthly_income NUMERIC(12,2),
  confidence_score NUMERIC(5,2),
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  dob DATE,
  relationship TEXT,
  pregnant BOOLEAN NOT NULL DEFAULT false,
  disabled BOOLEAN NOT NULL DEFAULT false,
  over_65 BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  member_id UUID REFERENCES household_members(id),
  income_type TEXT,
  employer_name TEXT,
  monthly_amount NUMERIC(12,2),
  verified BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  asset_type TEXT,
  value NUMERIC(14,2)
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  document_type TEXT,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INT,
  ocr_text TEXT
);

CREATE TABLE IF NOT EXISTS document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  model_name TEXT,
  raw_output JSONB,
  structured_output JSONB,
  confidence_score NUMERIC(5,2),
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  rule_name TEXT,
  severity TEXT,
  message TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eligibility_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  estimated_program TEXT,
  fpl_percentage NUMERIC(6,2),
  screening_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  reviewer_id UUID REFERENCES users(id),
  action_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  requested_by UUID REFERENCES users(id),
  message TEXT,
  due_date DATE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  action TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_organization_id ON applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id);

CREATE INDEX IF NOT EXISTS idx_household_members_application_id ON household_members(application_id);
CREATE INDEX IF NOT EXISTS idx_incomes_application_id ON incomes(application_id);
CREATE INDEX IF NOT EXISTS idx_incomes_member_id ON incomes(member_id);
CREATE INDEX IF NOT EXISTS idx_assets_application_id ON assets(application_id);

CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_extraction_json ON document_extractions USING GIN (structured_output);

CREATE INDEX IF NOT EXISTS idx_validation_application ON validation_results(application_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_screenings_application_id ON eligibility_screenings(application_id);
CREATE INDEX IF NOT EXISTS idx_review_actions_application_id ON review_actions(application_id);
CREATE INDEX IF NOT EXISTS idx_review_actions_reviewer_id ON review_actions(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_rfis_application_id ON rfis(application_id);
CREATE INDEX IF NOT EXISTS idx_rfis_requested_by ON rfis(requested_by);

CREATE INDEX IF NOT EXISTS idx_audit_application ON audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- mHealth schema hardening migration (schema-tolerant)
-- NOTE: Timestamp conversion assumes existing TIMESTAMP values are UTC.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Convert timestamp columns to timestamptz where those columns exist.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT v.table_name, v.column_name
    FROM (
      VALUES
        ('organizations', 'created_at'),
        ('users', 'created_at'),
        ('applicants', 'created_at'),
        ('applications', 'submitted_at'),
        ('applications', 'decided_at'),
        ('applications', 'created_at'),
        ('documents', 'uploaded_at'),
        ('document_extractions', 'extracted_at'),
        ('validation_results', 'created_at'),
        ('eligibility_screenings', 'created_at'),
        ('review_actions', 'created_at'),
        ('rfis', 'created_at'),
        ('audit_logs', 'created_at')
    ) AS v(table_name, column_name)
    JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = v.table_name
     AND c.column_name = v.column_name
    WHERE c.data_type = 'timestamp without time zone'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
      rec.table_name,
      rec.column_name,
      rec.column_name
    );
  END LOOP;
END $$;

-- Normalize nullable boolean/timestamp defaults only if columns exist.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (
      VALUES
        ('users', 'is_active', 'true'),
        ('household_members', 'pregnant', 'false'),
        ('household_members', 'disabled', 'false'),
        ('household_members', 'over_65', 'false'),
        ('incomes', 'verified', 'false'),
        ('validation_results', 'resolved', 'false'),
        ('rfis', 'resolved', 'false'),
        ('organizations', 'created_at', 'now()'),
        ('users', 'created_at', 'now()'),
        ('applicants', 'created_at', 'now()'),
        ('applications', 'created_at', 'now()'),
        ('documents', 'uploaded_at', 'now()'),
        ('document_extractions', 'extracted_at', 'now()'),
        ('validation_results', 'created_at', 'now()'),
        ('eligibility_screenings', 'created_at', 'now()'),
        ('review_actions', 'created_at', 'now()'),
        ('rfis', 'created_at', 'now()'),
        ('audit_logs', 'created_at', 'now()')
    ) AS v(table_name, column_name, sql_value)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = rec.table_name
        AND column_name = rec.column_name
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET %I = %s WHERE %I IS NULL',
        rec.table_name,
        rec.column_name,
        rec.sql_value,
        rec.column_name
      );
    END IF;
  END LOOP;
END $$;

-- Keep incomes internally consistent where required columns exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incomes' AND column_name = 'member_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incomes' AND column_name = 'application_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'household_members' AND column_name = 'id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'household_members' AND column_name = 'application_id'
  ) THEN
    EXECUTE $sql$
      UPDATE incomes i
      SET application_id = hm.application_id
      FROM household_members hm
      WHERE i.member_id = hm.id
        AND i.application_id IS DISTINCT FROM hm.application_id
    $sql$;

    EXECUTE $sql$
      UPDATE incomes i
      SET member_id = NULL
      WHERE i.member_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM household_members hm
          WHERE hm.id = i.member_id
            AND hm.application_id = i.application_id
        )
    $sql$;
  END IF;
END $$;

-- Repair invalid audit log references where possible.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'application_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'id'
  ) THEN
    EXECUTE $sql$
      UPDATE audit_logs a
      SET application_id = NULL
      WHERE a.application_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM applications ap
          WHERE ap.id = a.application_id
        )
    $sql$;
  END IF;
END $$;

-- Normalize invalid values before adding checks.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='household_size') THEN
    EXECUTE 'UPDATE applications SET household_size = NULL WHERE household_size IS NOT NULL AND household_size < 1';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='total_monthly_income') THEN
    EXECUTE 'UPDATE applications SET total_monthly_income = NULL WHERE total_monthly_income IS NOT NULL AND total_monthly_income < 0';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='confidence_score') THEN
    EXECUTE 'UPDATE applications SET confidence_score = NULL WHERE confidence_score IS NOT NULL AND (confidence_score < 0 OR confidence_score > 100)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incomes' AND column_name='monthly_amount') THEN
    EXECUTE 'UPDATE incomes SET monthly_amount = NULL WHERE monthly_amount IS NOT NULL AND monthly_amount < 0';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='value') THEN
    EXECUTE 'UPDATE assets SET value = NULL WHERE value IS NOT NULL AND value < 0';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_extractions' AND column_name='confidence_score') THEN
    EXECUTE 'UPDATE document_extractions SET confidence_score = NULL WHERE confidence_score IS NOT NULL AND (confidence_score < 0 OR confidence_score > 100)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eligibility_screenings' AND column_name='fpl_percentage') THEN
    EXECUTE 'UPDATE eligibility_screenings SET fpl_percentage = NULL WHERE fpl_percentage IS NOT NULL AND fpl_percentage < 0';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='validation_results' AND column_name='severity') THEN
    EXECUTE 'UPDATE validation_results SET severity = lower(severity) WHERE severity IS NOT NULL';
    EXECUTE 'UPDATE validation_results SET severity = NULL WHERE severity IS NOT NULL AND severity NOT IN (''warning'', ''error'')';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_actions' AND column_name='action_type') THEN
    EXECUTE 'UPDATE review_actions SET action_type = lower(action_type) WHERE action_type IS NOT NULL';
    EXECUTE 'UPDATE review_actions SET action_type = NULL WHERE action_type IS NOT NULL AND action_type NOT IN (''approve'', ''deny'', ''rfi'')';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='page_number') THEN
    EXECUTE 'UPDATE document_pages SET page_number = NULL WHERE page_number IS NOT NULL AND page_number <= 0';
  END IF;
END $$;

-- Remove duplicate (document_id, page_number) values by nulling subsequent duplicates.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='document_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='page_number') THEN
    EXECUTE $sql$
      WITH duplicate_pages AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY document_id, page_number
            ORDER BY id
          ) AS rn
        FROM document_pages
        WHERE page_number IS NOT NULL
      )
      UPDATE document_pages dp
      SET page_number = NULL
      FROM duplicate_pages d
      WHERE dp.id = d.id
        AND d.rn > 1
    $sql$;
  END IF;
END $$;

-- Set defaults if target columns exist.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (
      VALUES
        ('organizations', 'created_at', 'now()'),
        ('users', 'is_active', 'true'),
        ('users', 'created_at', 'now()'),
        ('applicants', 'created_at', 'now()'),
        ('applications', 'status', '''draft'''),
        ('applications', 'created_at', 'now()'),
        ('household_members', 'pregnant', 'false'),
        ('household_members', 'disabled', 'false'),
        ('household_members', 'over_65', 'false'),
        ('incomes', 'verified', 'false'),
        ('documents', 'uploaded_at', 'now()'),
        ('document_extractions', 'extracted_at', 'now()'),
        ('validation_results', 'resolved', 'false'),
        ('validation_results', 'created_at', 'now()'),
        ('eligibility_screenings', 'created_at', 'now()'),
        ('review_actions', 'created_at', 'now()'),
        ('rfis', 'resolved', 'false'),
        ('rfis', 'created_at', 'now()'),
        ('audit_logs', 'created_at', 'now()')
    ) AS v(table_name, column_name, sql_default)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = rec.table_name
        AND column_name = rec.column_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %s',
        rec.table_name,
        rec.column_name,
        rec.sql_default
      );
    END IF;
  END LOOP;
END $$;

-- Set NOT NULL where columns exist (after normalization).
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (
      VALUES
        ('users', 'is_active'),
        ('applications', 'status'),
        ('household_members', 'pregnant'),
        ('household_members', 'disabled'),
        ('household_members', 'over_65'),
        ('incomes', 'verified'),
        ('validation_results', 'resolved'),
        ('rfis', 'resolved')
    ) AS v(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = rec.table_name
        AND column_name = rec.column_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL',
        rec.table_name,
        rec.column_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  ALTER TABLE household_members
    ADD CONSTRAINT household_members_id_application_id_key
    UNIQUE (id, application_id);
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE incomes
    ADD CONSTRAINT incomes_member_application_fk
    FOREIGN KEY (member_id, application_id)
    REFERENCES household_members(id, application_id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_application_fk
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE applications
    ADD CONSTRAINT applications_household_size_check
    CHECK (household_size IS NULL OR household_size >= 1);
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE applications
    ADD CONSTRAINT applications_total_monthly_income_non_negative
    CHECK (total_monthly_income IS NULL OR total_monthly_income >= 0);
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE applications
    ADD CONSTRAINT applications_confidence_score_range
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE incomes
    ADD CONSTRAINT incomes_monthly_amount_non_negative
    CHECK (monthly_amount IS NULL OR monthly_amount >= 0);
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE assets
    ADD CONSTRAINT assets_value_non_negative
    CHECK (value IS NULL OR value >= 0);
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE document_pages
    ADD CONSTRAINT document_pages_page_number_check
    CHECK (page_number IS NULL OR page_number > 0);
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE document_pages
    ADD CONSTRAINT document_pages_document_id_page_number_key
    UNIQUE (document_id, page_number);
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE document_extractions
    ADD CONSTRAINT document_extractions_confidence_score_range
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE validation_results
    ADD CONSTRAINT validation_results_severity_check
    CHECK (severity IS NULL OR severity IN ('warning', 'error'));
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE eligibility_screenings
    ADD CONSTRAINT eligibility_screenings_fpl_non_negative
    CHECK (fpl_percentage IS NULL OR fpl_percentage >= 0);
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE review_actions
    ADD CONSTRAINT review_actions_action_type_check
    CHECK (action_type IS NULL OR action_type IN ('approve', 'deny', 'rfi'));
EXCEPTION
  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;
END $$;

-- Create indexes only when required columns exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='status') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_application_status ON applications(status)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='organization_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_applications_organization_id ON applications(organization_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='applicant_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='organization_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name='role_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applicants' AND column_name='user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='household_members' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_household_members_application_id ON household_members(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incomes' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_incomes_application_id ON incomes(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incomes' AND column_name='member_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_incomes_member_id ON incomes(member_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assets_application_id ON assets(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='uploaded_by') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='document_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_extractions' AND column_name='document_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON document_extractions(document_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_extractions' AND column_name='structured_output') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_extraction_json ON document_extractions USING GIN (structured_output)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='validation_results' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_validation_application ON validation_results(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eligibility_screenings' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eligibility_screenings_application_id ON eligibility_screenings(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_actions' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_review_actions_application_id ON review_actions(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_actions' AND column_name='reviewer_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_review_actions_reviewer_id ON review_actions(reviewer_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rfis' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rfis_application_id ON rfis(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rfis' AND column_name='requested_by') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rfis_requested_by ON rfis(requested_by)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='application_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_application ON audit_logs(application_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)';
  END IF;
END $$;

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applicants'
      AND column_name = 'user_id'
  ) THEN
    BEGIN
      ALTER TABLE public.applicants
        ADD CONSTRAINT applicants_user_id_key UNIQUE (user_id);
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    password_hash,
    is_active,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    'supabase_auth_managed',
    true,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    is_active = true;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applicants'
      AND column_name = 'user_id'
  ) THEN
    INSERT INTO public.applicants (
      user_id,
      first_name,
      last_name,
      phone,
      created_at
    )
    VALUES (
      NEW.id,
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
      last_name = COALESCE(EXCLUDED.last_name, public.applicants.last_name),
      phone = COALESCE(EXCLUDED.phone, public.applicants.phone);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

BEGIN;

CREATE OR REPLACE FUNCTION public.request_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

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
      AND r.name IN ('admin', 'reviewer')
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

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eligibility_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select ON public.organizations;
DROP POLICY IF EXISTS organizations_write_staff ON public.organizations;
CREATE POLICY organizations_select
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.can_access_organization(id));
CREATE POLICY organizations_write_staff
  ON public.organizations
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_select
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.can_access_user(id));
CREATE POLICY users_update
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user(id))
  WITH CHECK (public.can_access_user(id));

DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_write_staff ON public.user_roles;
CREATE POLICY user_roles_select
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.can_access_user(user_id));
CREATE POLICY user_roles_write_staff
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS applicants_select ON public.applicants;
DROP POLICY IF EXISTS applicants_insert ON public.applicants;
DROP POLICY IF EXISTS applicants_update ON public.applicants;
CREATE POLICY applicants_select
  ON public.applicants
  FOR SELECT
  TO authenticated
  USING (public.can_access_user(user_id));
CREATE POLICY applicants_insert
  ON public.applicants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_user(user_id));
CREATE POLICY applicants_update
  ON public.applicants
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user(user_id))
  WITH CHECK (public.can_access_user(user_id));

DROP POLICY IF EXISTS applications_select ON public.applications;
DROP POLICY IF EXISTS applications_insert ON public.applications;
DROP POLICY IF EXISTS applications_update ON public.applications;
DROP POLICY IF EXISTS applications_delete ON public.applications;
CREATE POLICY applications_select
  ON public.applications
  FOR SELECT
  TO authenticated
  USING (public.can_access_application(id));
CREATE POLICY applications_insert
  ON public.applications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_applicant(applicant_id));
CREATE POLICY applications_update
  ON public.applications
  FOR UPDATE
  TO authenticated
  USING (public.can_access_application(id))
  WITH CHECK (public.can_access_applicant(applicant_id));
CREATE POLICY applications_delete
  ON public.applications
  FOR DELETE
  TO authenticated
  USING (public.can_access_application(id));

DROP POLICY IF EXISTS household_members_owner_rw ON public.household_members;
CREATE POLICY household_members_owner_rw
  ON public.household_members
  FOR ALL
  TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

DROP POLICY IF EXISTS incomes_owner_rw ON public.incomes;
CREATE POLICY incomes_owner_rw
  ON public.incomes
  FOR ALL
  TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

DROP POLICY IF EXISTS assets_owner_rw ON public.assets;
CREATE POLICY assets_owner_rw
  ON public.assets
  FOR ALL
  TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

DROP POLICY IF EXISTS documents_select ON public.documents;
DROP POLICY IF EXISTS documents_insert ON public.documents;
DROP POLICY IF EXISTS documents_update ON public.documents;
DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_select
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY documents_insert
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_application(application_id)
    AND (uploaded_by IS NULL OR public.can_access_user(uploaded_by))
  );
CREATE POLICY documents_update
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (
    public.can_access_application(application_id)
    AND (uploaded_by IS NULL OR public.can_access_user(uploaded_by))
  );
CREATE POLICY documents_delete
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (public.can_access_application(application_id));

DROP POLICY IF EXISTS document_pages_select ON public.document_pages;
DROP POLICY IF EXISTS document_pages_write_staff ON public.document_pages;
CREATE POLICY document_pages_select
  ON public.document_pages
  FOR SELECT
  TO authenticated
  USING (public.can_access_document(document_id));
CREATE POLICY document_pages_write_staff
  ON public.document_pages
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS document_extractions_select ON public.document_extractions;
DROP POLICY IF EXISTS document_extractions_write_staff ON public.document_extractions;
CREATE POLICY document_extractions_select
  ON public.document_extractions
  FOR SELECT
  TO authenticated
  USING (public.can_access_document(document_id));
CREATE POLICY document_extractions_write_staff
  ON public.document_extractions
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS validation_results_select ON public.validation_results;
DROP POLICY IF EXISTS validation_results_write_staff ON public.validation_results;
CREATE POLICY validation_results_select
  ON public.validation_results
  FOR SELECT
  TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY validation_results_write_staff
  ON public.validation_results
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS eligibility_screenings_select ON public.eligibility_screenings;
DROP POLICY IF EXISTS eligibility_screenings_write_staff ON public.eligibility_screenings;
CREATE POLICY eligibility_screenings_select
  ON public.eligibility_screenings
  FOR SELECT
  TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY eligibility_screenings_write_staff
  ON public.eligibility_screenings
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS review_actions_select ON public.review_actions;
DROP POLICY IF EXISTS review_actions_write_staff ON public.review_actions;
CREATE POLICY review_actions_select
  ON public.review_actions
  FOR SELECT
  TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY review_actions_write_staff
  ON public.review_actions
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS rfis_select ON public.rfis;
DROP POLICY IF EXISTS rfis_write_staff ON public.rfis;
CREATE POLICY rfis_select
  ON public.rfis
  FOR SELECT
  TO authenticated
  USING (public.can_access_application(application_id));
CREATE POLICY rfis_write_staff
  ON public.rfis
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_write_staff ON public.audit_logs;
CREATE POLICY audit_logs_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.can_access_user(user_id));
CREATE POLICY audit_logs_write_staff
  ON public.audit_logs
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

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
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

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
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

BEGIN;

INSERT INTO public.users (
  id,
  email,
  password_hash,
  is_active,
  created_at
)
SELECT
  au.id,
  au.email::text,
  'supabase_auth_managed',
  true,
  COALESCE(au.created_at, now())
FROM auth.users au
WHERE au.email IS NOT NULL
  AND au.email <> ''
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  is_active = true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applicants'
      AND column_name = 'user_id'
  ) THEN
    INSERT INTO public.applicants (
      user_id,
      first_name,
      last_name,
      phone,
      created_at
    )
    SELECT
      au.id,
      NULLIF(au.raw_user_meta_data->>'first_name', ''),
      NULLIF(au.raw_user_meta_data->>'last_name', ''),
      NULLIF(au.raw_user_meta_data->>'phone', ''),
      COALESCE(au.created_at, now())
    FROM auth.users au
    INNER JOIN public.users pu
      ON pu.id = au.id
    ON CONFLICT (user_id) DO UPDATE
    SET
      first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
      last_name = COALESCE(EXCLUDED.last_name, public.applicants.last_name),
      phone = COALESCE(EXCLUDED.phone, public.applicants.phone);
  END IF;
END $$;

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

BEGIN;

UPDATE auth.users
SET
  instance_id = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'::uuid),
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change_confirm_status = COALESCE(email_change_confirm_status, 0),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false)
WHERE
  instance_id IS NULL
  OR confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_new IS NULL
  OR email_change_token_current IS NULL
  OR reauthentication_token IS NULL
  OR email_change IS NULL
  OR phone_change IS NULL
  OR phone_change_token IS NULL
  OR email_change_confirm_status IS NULL;

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

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
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- ============================================================
-- Storage bucket policies for "masshealth-dev"
--
-- Applied via: supabase db push  (runs as supabase_storage_admin)
-- NOT via plain psql — postgres user doesn't own storage.objects.
--
-- Folder layout inside the bucket (all under {userId}/ for isolation):
--   {userId}/avatar/avatar.{ext}                     ← profile picture
--   {userId}/{applicationId}/{documentId}/{fileName} ← application docs
--
-- These policies only apply when clients use a user JWT.
-- Server-side code using SUPABASE_SERVICE_ROLE_KEY bypasses them entirely.
-- ============================================================

-- Drop first so this file is safe to re-run
DROP POLICY IF EXISTS "masshealth_dev_upload_own"  ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_read_own"    ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_delete_own"  ON storage.objects;
DROP POLICY IF EXISTS "masshealth_dev_staff_all"   ON storage.objects;

-- Authenticated users may upload only inside their own {userId}/ folder
CREATE POLICY "masshealth_dev_upload_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may read only their own files
CREATE POLICY "masshealth_dev_read_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may delete only their own files
CREATE POLICY "masshealth_dev_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff (reviewer / admin roles) get full access to the entire bucket
CREATE POLICY "masshealth_dev_staff_all"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'masshealth-dev'
    AND public.is_staff()
  )
  WITH CHECK (
    bucket_id = 'masshealth-dev'
    AND public.is_staff()
  );
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

/**
 * Collaborative Session Schema
 * Screen-share + chat sessions between social workers and patients.
 * Run after social_worker_schema.sql
 * @author: Bin Lee
 */

-- ── Collaborative sessions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collaborative_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sw_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  ended_by          UUID        REFERENCES auth.users(id),
  invite_message    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_sw
  ON public.collaborative_sessions(sw_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_patient
  ON public.collaborative_sessions(patient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_status
  ON public.collaborative_sessions(status);

-- ── Session messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.collaborative_sessions(id) ON DELETE CASCADE,
  sender_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL DEFAULT 'text'
    CHECK (type IN ('text', 'voice')),
  content       TEXT,
  storage_path  TEXT,
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_msgs_session
  ON public.session_messages(session_id, created_at);

-- ── auto-update updated_at ────────────────────────────────────────────────────

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

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.collaborative_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_select ON public.collaborative_sessions;
DROP POLICY IF EXISTS sessions_insert ON public.collaborative_sessions;
DROP POLICY IF EXISTS sessions_update ON public.collaborative_sessions;
DROP POLICY IF EXISTS session_msgs_select ON public.session_messages;
DROP POLICY IF EXISTS session_msgs_insert ON public.session_messages;

-- Sessions: SW or patient who is a participant can select
CREATE POLICY sessions_select
  ON public.collaborative_sessions FOR SELECT TO authenticated
  USING (
    sw_user_id = public.request_user_id()
    OR patient_user_id = public.request_user_id()
    OR public.is_staff()
  );

-- Only the SW (or staff) can create a session
CREATE POLICY sessions_insert
  ON public.collaborative_sessions FOR INSERT TO authenticated
  WITH CHECK (sw_user_id = public.request_user_id() OR public.is_staff());

-- SW or patient can update status (accept, decline, start, end)
CREATE POLICY sessions_update
  ON public.collaborative_sessions FOR UPDATE TO authenticated
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

-- Messages: participants can select
CREATE POLICY session_msgs_select
  ON public.session_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collaborative_sessions s
      WHERE s.id = session_id
        AND (
          s.sw_user_id     = public.request_user_id()
          OR s.patient_user_id = public.request_user_id()
        )
    )
    OR public.is_staff()
  );

-- Messages: participants can insert (only when session is active)
CREATE POLICY session_msgs_insert
  ON public.session_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.request_user_id()
    AND EXISTS (
      SELECT 1 FROM public.collaborative_sessions s
      WHERE s.id = session_id
        AND s.status = 'active'
        AND (
          s.sw_user_id     = public.request_user_id()
          OR s.patient_user_id = public.request_user_id()
        )
    )
  );

-- ── Extend notifications.type check constraint ────────────────────────────────
-- NOTE: notifications is owned by supabase_admin; run the two statements below
-- as that role if this migration is replayed from scratch.
-- They have already been applied; keeping them here for documentation only.
--
-- ALTER TABLE public.notifications
--   DROP CONSTRAINT IF EXISTS notifications_type_check;
--
-- ALTER TABLE public.notifications
--   ADD CONSTRAINT notifications_type_check
--   CHECK (type IN (
--     'status_change', 'document_request', 'renewal_reminder', 'deadline',
--     'general', 'session_invite', 'session_starting'
--   ));
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Social Worker, Companies, and Patient Access Schema
-- @author: Bin Lee

INSERT INTO public.roles (name) VALUES ('social_worker') ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  npi         TEXT,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  phone       TEXT,
  email_domain TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID        REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.social_worker_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  company_id      UUID        NOT NULL REFERENCES public.companies(id),
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  bio             TEXT,
  avatar_url      TEXT,
  license_number  TEXT,
  job_title       TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  approved_by     UUID        REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.patient_social_worker_access (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  social_worker_user_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at            TIMESTAMPTZ,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE(patient_user_id, social_worker_user_id)
);

CREATE INDEX IF NOT EXISTS idx_companies_status           ON public.companies(status);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_user           ON public.social_worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_company        ON public.social_worker_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_status         ON public.social_worker_profiles(status);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_name           ON public.social_worker_profiles(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_sw_access_patient          ON public.patient_social_worker_access(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_access_sw               ON public.patient_social_worker_access(social_worker_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_access_active           ON public.patient_social_worker_access(is_active);

ALTER TABLE public.companies                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_worker_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_social_worker_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select_approved ON public.companies;
CREATE POLICY companies_select_approved ON public.companies FOR SELECT TO authenticated
  USING (status = 'approved' OR public.is_staff());
DROP POLICY IF EXISTS companies_write_staff ON public.companies;
CREATE POLICY companies_write_staff ON public.companies FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS sw_profiles_select ON public.social_worker_profiles;
CREATE POLICY sw_profiles_select ON public.social_worker_profiles FOR SELECT TO authenticated
  USING (user_id = public.request_user_id() OR public.is_staff());
DROP POLICY IF EXISTS sw_profiles_insert ON public.social_worker_profiles;
CREATE POLICY sw_profiles_insert ON public.social_worker_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = public.request_user_id() OR public.is_staff());
DROP POLICY IF EXISTS sw_profiles_update ON public.social_worker_profiles;
CREATE POLICY sw_profiles_update ON public.social_worker_profiles FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS sw_access_select ON public.patient_social_worker_access;
CREATE POLICY sw_access_select ON public.patient_social_worker_access FOR SELECT TO authenticated
  USING (
    patient_user_id = public.request_user_id()
    OR social_worker_user_id = public.request_user_id()
    OR public.is_staff()
  );
DROP POLICY IF EXISTS sw_access_insert ON public.patient_social_worker_access;
CREATE POLICY sw_access_insert ON public.patient_social_worker_access FOR INSERT TO authenticated
  WITH CHECK (patient_user_id = public.request_user_id() OR public.is_staff());
DROP POLICY IF EXISTS sw_access_update ON public.patient_social_worker_access;
CREATE POLICY sw_access_update ON public.patient_social_worker_access FOR UPDATE TO authenticated
  USING (patient_user_id = public.request_user_id() OR public.is_staff())
  WITH CHECK (patient_user_id = public.request_user_id() OR public.is_staff());
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Notifications table
-- @author: Bin Lee

CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT        NOT NULL CHECK (type IN (
                              'status_change','document_request','renewal_reminder',
                              'deadline','general'
                            )),
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  read_at       TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread  ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_notifications ON public.notifications;
CREATE POLICY users_own_notifications ON public.notifications FOR ALL
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS staff_all_notifications ON public.notifications;
CREATE POLICY staff_all_notifications ON public.notifications FOR ALL
  USING (public.is_staff());
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Invitations schema — depends on companies (20260323)
-- @author: Bin Lee

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

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

CREATE INDEX IF NOT EXISTS idx_invitations_token      ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email      ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_company_id ON public.invitations(company_id);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_manage_invitations ON public.invitations;
CREATE POLICY admins_manage_invitations ON public.invitations FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- User Profiles table — depends on applicants (20260301)
-- @author: Bin Lee

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  profile_data JSONB       NOT NULL DEFAULT '{}',
  bank_data    JSONB       NOT NULL DEFAULT '{}',
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_applicant_id ON public.user_profiles(applicant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated      ON public.user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_json         ON public.user_profiles USING GIN (profile_data);

CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_user_profile_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_owner_rw ON public.user_profiles;
CREATE POLICY user_profiles_owner_rw ON public.user_profiles FOR ALL TO authenticated
  USING  (public.can_access_applicant(applicant_id))
  WITH CHECK (public.can_access_applicant(applicant_id));
DROP POLICY IF EXISTS user_profiles_staff_all ON public.user_profiles;
CREATE POLICY user_profiles_staff_all ON public.user_profiles FOR ALL TO authenticated
  USING  (public.is_staff()) WITH CHECK (public.is_staff());
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Separate staff identity from patients table; update handle_new_auth_user trigger
-- Depends on social_worker_profiles (20260323)
-- @author: Bin Lee

BEGIN;

ALTER TABLE public.social_worker_profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS bio        TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_sw_profiles_name
  ON public.social_worker_profiles (last_name, first_name);

UPDATE public.social_worker_profiles swp
SET
  first_name = COALESCE(swp.first_name, ap.first_name),
  last_name  = COALESCE(swp.last_name,  ap.last_name),
  phone      = COALESCE(swp.phone,      ap.phone)
FROM public.applicants ap
WHERE ap.user_id = swp.user_id
  AND (ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL OR ap.phone IS NOT NULL);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT;
BEGIN
  INSERT INTO public.users (id, email, password_hash, is_active, created_at)
  VALUES (NEW.id, NEW.email, 'supabase_auth_managed', true, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, is_active = true;

  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'patient');

  IF v_role NOT IN ('social_worker', 'admin', 'reviewer') THEN
    INSERT INTO public.applicants (user_id, first_name, last_name, phone, created_at)
    VALUES (
      NEW.id,
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'last_name',  ''),
      NULLIF(NEW.raw_user_meta_data->>'phone',       ''),
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (user_id) DO UPDATE
      SET first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
          last_name  = COALESCE(EXCLUDED.last_name,  public.applicants.last_name),
          phone      = COALESCE(EXCLUDED.phone,      public.applicants.phone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

DELETE FROM public.applicants ap
WHERE EXISTS (
  SELECT 1 FROM public.social_worker_profiles swp WHERE swp.user_id = ap.user_id
)
AND NOT EXISTS (
  SELECT 1 FROM public.applications a WHERE a.applicant_id = ap.id
);

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Benefit Orchestration Schema — depends on applicants (20260301)
-- @author: Bin Lee

CREATE TABLE IF NOT EXISTS public.family_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  profile_data JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_family_profiles_applicant_id ON public.family_profiles(applicant_id);
CREATE INDEX IF NOT EXISTS idx_family_profiles_updated      ON public.family_profiles(updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_family_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS family_profiles_updated_at ON public.family_profiles;
CREATE TRIGGER family_profiles_updated_at
  BEFORE UPDATE ON public.family_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_family_profile_updated_at();

CREATE TABLE IF NOT EXISTS public.benefit_stack_results (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_profile_id UUID        NOT NULL REFERENCES public.family_profiles(id) ON DELETE CASCADE,
  stack_data        JSONB       NOT NULL,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_profile   ON public.benefit_stack_results(family_profile_id);
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_generated ON public.benefit_stack_results(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_benefit_stack_results_json      ON public.benefit_stack_results USING GIN (stack_data);

ALTER TABLE public.family_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_stack_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_profiles_owner_rw ON public.family_profiles;
CREATE POLICY family_profiles_owner_rw ON public.family_profiles FOR ALL TO authenticated
  USING  (public.can_access_applicant(applicant_id))
  WITH CHECK (public.can_access_applicant(applicant_id));

DROP POLICY IF EXISTS benefit_stack_results_owner_select ON public.benefit_stack_results;
CREATE POLICY benefit_stack_results_owner_select ON public.benefit_stack_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.family_profiles fp
    WHERE fp.id = family_profile_id AND public.can_access_applicant(fp.applicant_id)
  ));
DROP POLICY IF EXISTS benefit_stack_results_owner_insert ON public.benefit_stack_results;
CREATE POLICY benefit_stack_results_owner_insert ON public.benefit_stack_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.family_profiles fp
    WHERE fp.id = family_profile_id AND public.can_access_applicant(fp.applicant_id)
  ));
DROP POLICY IF EXISTS benefit_stack_results_staff_all ON public.benefit_stack_results;
CREATE POLICY benefit_stack_results_staff_all ON public.benefit_stack_results FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- SW Messaging: engagement requests + direct messages
-- Depends on: social_worker_schema (20260323), notifications (20260324), collaborative_sessions (20260322)
-- @author: Bin Lee

CREATE TABLE IF NOT EXISTS public.sw_engagement_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sw_user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  patient_message   TEXT,
  rejection_note    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sw_engagement_requests_active_uq
  ON public.sw_engagement_requests (patient_user_id, sw_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS sw_engagement_requests_patient_idx
  ON public.sw_engagement_requests (patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_engagement_requests_sw_idx
  ON public.sw_engagement_requests (sw_user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_sw_request_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS sw_engagement_requests_updated_at ON public.sw_engagement_requests;
CREATE TRIGGER sw_engagement_requests_updated_at
  BEFORE UPDATE ON public.sw_engagement_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_sw_request_updated_at();

ALTER TABLE public.sw_engagement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients see own engagement requests" ON public.sw_engagement_requests;
CREATE POLICY "Patients see own engagement requests"   ON public.sw_engagement_requests FOR SELECT USING (patient_user_id = auth.uid());
DROP POLICY IF EXISTS "Patients create engagement requests" ON public.sw_engagement_requests;
CREATE POLICY "Patients create engagement requests"    ON public.sw_engagement_requests FOR INSERT WITH CHECK (patient_user_id = auth.uid());
DROP POLICY IF EXISTS "Patients cancel own pending requests" ON public.sw_engagement_requests;
CREATE POLICY "Patients cancel own pending requests"   ON public.sw_engagement_requests FOR UPDATE USING (patient_user_id = auth.uid() AND status = 'pending');
DROP POLICY IF EXISTS "SWs see requests for them" ON public.sw_engagement_requests;
CREATE POLICY "SWs see requests for them"              ON public.sw_engagement_requests FOR SELECT USING (sw_user_id = auth.uid());
DROP POLICY IF EXISTS "SWs respond to pending requests" ON public.sw_engagement_requests;
CREATE POLICY "SWs respond to pending requests"        ON public.sw_engagement_requests FOR UPDATE USING (sw_user_id = auth.uid() AND status = 'pending');
DROP POLICY IF EXISTS "Staff see all engagement requests" ON public.sw_engagement_requests;
CREATE POLICY "Staff see all engagement requests"      ON public.sw_engagement_requests FOR ALL   USING (public.is_staff());

CREATE TABLE IF NOT EXISTS public.sw_direct_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sw_user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_type     TEXT        NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'voice', 'image')),
  content          TEXT,
  storage_path     TEXT,
  duration_sec     INTEGER,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sw_direct_messages_thread_idx ON public.sw_direct_messages (sw_user_id, patient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_direct_messages_sender_idx ON public.sw_direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sw_direct_messages_unread_idx ON public.sw_direct_messages (sw_user_id, patient_user_id) WHERE read_at IS NULL;

ALTER TABLE public.sw_direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DM participants can view messages" ON public.sw_direct_messages;
CREATE POLICY "DM participants can view messages" ON public.sw_direct_messages FOR SELECT
  USING (sw_user_id = auth.uid() OR patient_user_id = auth.uid());
DROP POLICY IF EXISTS "DM participants can send messages" ON public.sw_direct_messages;
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
DROP POLICY IF EXISTS "DM participants can mark read" ON public.sw_direct_messages;
CREATE POLICY "DM participants can mark read" ON public.sw_direct_messages FOR UPDATE
  USING (sw_user_id = auth.uid() OR patient_user_id = auth.uid());
DROP POLICY IF EXISTS "Staff see all DMs" ON public.sw_direct_messages;
CREATE POLICY "Staff see all DMs" ON public.sw_direct_messages FOR ALL
  USING (public.is_staff());

-- Extend notification types for SW messaging
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'status_change','document_request','renewal_reminder','deadline','general',
  'session_invite','session_starting',
  'sw_engagement_request','sw_engagement_accepted','sw_engagement_rejected',
  'new_direct_message'
));
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Documents Storage migration — extends documents table for Supabase Storage
-- @author: Bin Lee

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
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Identity Verification Schema — depends on applicants + users (20260301)
-- @author: Bin Lee

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS identity_status      TEXT NOT NULL DEFAULT 'unverified'
    CHECK (identity_status IN ('unverified', 'pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_provider    TEXT DEFAULT 'dl_barcode',
  ADD COLUMN IF NOT EXISTS identity_score       SMALLINT,
  ADD COLUMN IF NOT EXISTS dl_number_hash       TEXT,
  ADD COLUMN IF NOT EXISTS dl_expiration_date   DATE,
  ADD COLUMN IF NOT EXISTS dl_issuing_state     TEXT;

CREATE TABLE IF NOT EXISTS public.identity_verification_attempts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id       UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  status             TEXT        NOT NULL CHECK (status IN ('verified', 'needs_review', 'failed')),
  score              SMALLINT    NOT NULL,
  breakdown          JSONB       NOT NULL DEFAULT '{}',
  dl_number_hash     TEXT,
  dl_expiration_date DATE,
  dl_issuing_state   TEXT,
  is_expired         BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address         TEXT,
  user_agent         TEXT
);

CREATE INDEX IF NOT EXISTS idx_identity_attempts_applicant   ON public.identity_verification_attempts (applicant_id);
CREATE INDEX IF NOT EXISTS idx_identity_attempts_user        ON public.identity_verification_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_applicants_identity_status    ON public.applicants (identity_status);

ALTER TABLE public.identity_verification_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_attempts_owner_select ON public.identity_verification_attempts;
CREATE POLICY identity_attempts_owner_select ON public.identity_verification_attempts FOR SELECT
  USING (public.can_access_applicant(applicant_id));
DROP POLICY IF EXISTS identity_attempts_staff_all ON public.identity_verification_attempts;
CREATE POLICY identity_attempts_staff_all    ON public.identity_verification_attempts FOR ALL
  USING (public.is_staff());

CREATE OR REPLACE VIEW public.identity_pending_review AS
  SELECT
    a.id              AS applicant_id,
    a.first_name,
    a.last_name,
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
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Add avatar_url to user_profiles (idempotent — column may already exist from 20260326)
-- @author: Bin Lee

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.avatar_url IS
  'Full public URL of the user''s profile picture stored in Supabase Storage bucket "profile-avatars".
   Path format: {user_id}/avatar.{ext}?v={timestamp}. NULL means no avatar uploaded.';
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Cross-device identity verification sessions — depends on identity_verification (20260331)
-- @author: Bin Lee

CREATE TABLE IF NOT EXISTS public.mobile_verify_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token            TEXT        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  user_id          UUID        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  applicant_id     UUID        NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  verify_status    TEXT        CHECK (verify_status IN ('verified', 'needs_review', 'failed')),
  verify_score     SMALLINT,
  verify_breakdown JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_verify_sessions_token ON public.mobile_verify_sessions (token);
CREATE INDEX IF NOT EXISTS idx_mobile_verify_sessions_user  ON public.mobile_verify_sessions (user_id, status);

ALTER TABLE public.mobile_verify_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_sessions_owner ON public.mobile_verify_sessions;
CREATE POLICY mobile_sessions_owner ON public.mobile_verify_sessions FOR ALL
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS mobile_sessions_staff ON public.mobile_verify_sessions;
CREATE POLICY mobile_sessions_staff ON public.mobile_verify_sessions FOR ALL
  USING (public.is_staff());
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Add extracted_data to mobile_verify_sessions for AAMVA auto-fill
-- @author: Bin Lee

ALTER TABLE public.mobile_verify_sessions
  ADD COLUMN IF NOT EXISTS extracted_data JSONB;

COMMENT ON COLUMN public.mobile_verify_sessions.extracted_data IS
  'Parsed AAMVA fields for profile auto-fill. No sensitive PII — license number and DOB excluded.
   Shape: {"firstName":"JOHN","lastName":"SMITH","addressLine1":"123 MAIN ST","city":"BOSTON","state":"MA","zip":"02101"}';
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

BEGIN;

DROP POLICY IF EXISTS sessions_insert ON public.collaborative_sessions;

CREATE POLICY sessions_insert
  ON public.collaborative_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    OR (
      sw_user_id = public.request_user_id()
      AND EXISTS (
        SELECT 1
        FROM public.patient_social_worker_access psa
        WHERE psa.patient_user_id = collaborative_sessions.patient_user_id
          AND psa.social_worker_user_id = collaborative_sessions.sw_user_id
          AND psa.is_active = true
      )
    )
  );

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

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
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Server-side session revocation list.
-- Used by lib/auth/require-auth.ts to reject access tokens after admin force logout.
-- @author: Bin Lee

CREATE TABLE IF NOT EXISTS public.revoked_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT,
  token_hash  TEXT,
  reason      TEXT        NOT NULL DEFAULT 'manual_revocation',
  revoked_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  CONSTRAINT revoked_sessions_subject_check
    CHECK (user_id IS NOT NULL OR session_id IS NOT NULL OR token_hash IS NOT NULL),
  CONSTRAINT revoked_sessions_token_hash_check
    CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE public.revoked_sessions IS
  'Revoked access-token sessions. Rows may target an exact token hash, a Supabase session_id/sid/jti claim, or all tokens for a user issued before revoked_at.';

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_user_active
  ON public.revoked_sessions (user_id, revoked_at DESC);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_session_active
  ON public.revoked_sessions (session_id)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_revoked_sessions_token_hash
  ON public.revoked_sessions (token_hash)
  WHERE token_hash IS NOT NULL;

ALTER TABLE public.revoked_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS revoked_sessions_staff_select ON public.revoked_sessions;
CREATE POLICY revoked_sessions_staff_select
  ON public.revoked_sessions FOR SELECT TO authenticated
  USING (public.is_staff());
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- ─────────────────────────────────────────────────────────────────────────────
-- Encrypt PHI fields on the applicants table
--
-- HIPAA §164.312(a)(2)(iv) — Encryption and Decryption
-- Encrypt all stored PHI at rest.  Fields encrypted with AES-256-GCM via the
-- application-layer encryptField() function (PROFILE_ENCRYPTION_KEY env var).
--
-- Migration strategy (zero-downtime dual-write window)
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. This migration adds *_encrypted TEXT columns for each PHI field.
-- 2. Application code immediately writes only to *_encrypted columns and reads
--    *_encrypted with a fallback to the legacy plaintext column when the
--    encrypted column is NULL (pre-backfill rows).
-- 3. Run: pnpm tsx scripts/backfill-phi-encryption.ts
--    to encrypt all existing plaintext values into the new columns.
-- 4. After the backfill is verified, run a follow-up migration to NULL out
--    and then DROP the plaintext columns (tracked in TODO comment below).
--
-- About driver's licence number
-- ─────────────────────────────────────────────────────────────────────────────
-- dl_number_hash already stores only a SHA-256 hash of the licence number.
-- The plaintext is never persisted.  No change is needed for that column.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.applicants
  -- Name
  ADD COLUMN IF NOT EXISTS first_name_encrypted  TEXT,
  ADD COLUMN IF NOT EXISTS last_name_encrypted   TEXT,

  -- Date of birth — stored as encrypted text (ISO date string "YYYY-MM-DD")
  ADD COLUMN IF NOT EXISTS dob_encrypted         TEXT,

  -- Contact
  ADD COLUMN IF NOT EXISTS phone_encrypted       TEXT,

  -- Address
  ADD COLUMN IF NOT EXISTS address_line1_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_line2_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS city_encrypted         TEXT,
  ADD COLUMN IF NOT EXISTS state_encrypted        TEXT,
  ADD COLUMN IF NOT EXISTS zip_encrypted          TEXT;

-- TODO (post-backfill cleanup migration):
--   UPDATE public.applicants SET first_name = NULL WHERE first_name_encrypted IS NOT NULL;
--   UPDATE public.applicants SET last_name  = NULL WHERE last_name_encrypted  IS NOT NULL;
--   ... repeat for each column ...
--   ALTER TABLE public.applicants
--     DROP COLUMN first_name,
--     DROP COLUMN last_name,
--     DROP COLUMN dob,
--     DROP COLUMN phone,
--     DROP COLUMN address_line1,
--     DROP COLUMN address_line2,
--     DROP COLUMN city,
--     DROP COLUMN state,
--     DROP COLUMN zip;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT '{}',
  device_type TEXT NOT NULL,
  backed_up BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_passkey_credentials_user_id
  ON public.admin_passkey_credentials(user_id);

COMMIT;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Migration: enforce_role_exclusivity
-- Admin and social_worker are distinct roles — a user may not hold both simultaneously.
-- This trigger fires before every INSERT on public.user_roles and raises an exception
-- if the incoming role would create an admin+social_worker conflict for that user.

CREATE OR REPLACE FUNCTION public.check_admin_social_worker_exclusivity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  incoming_role_name TEXT;
  conflicting_role   TEXT;
BEGIN
  -- Resolve the name of the role being assigned.
  SELECT name INTO incoming_role_name
  FROM public.roles
  WHERE id = NEW.role_id;

  -- Only applies when the incoming role is admin or social_worker.
  IF incoming_role_name NOT IN ('admin', 'social_worker') THEN
    RETURN NEW;
  END IF;

  -- Determine the role that would conflict.
  conflicting_role := CASE incoming_role_name
    WHEN 'admin'         THEN 'social_worker'
    WHEN 'social_worker' THEN 'admin'
  END;

  -- Reject if the user already holds the conflicting role.
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = NEW.user_id
      AND r.name    = conflicting_role
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
  FOR EACH ROW
  EXECUTE FUNCTION public.check_admin_social_worker_exclusivity();

-- Clean up any existing dual-role assignments (admin takes precedence).
-- Users who already have both roles lose the social_worker role.
DELETE FROM public.user_roles
WHERE (user_id, role_id) IN (
  SELECT ur.user_id, ur.role_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE r.name = 'social_worker'
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur2
      JOIN public.roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = ur.user_id
        AND r2.name = 'admin'
    )
);
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Growth analytics support: referral attribution and mailing-list capture.
-- These tables intentionally avoid storing PHI or authenticated profile data.

CREATE TABLE IF NOT EXISTS public.growth_referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL,
  landing_path  TEXT NOT NULL,
  referrer      TEXT,
  campaign      JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent    TEXT,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_referrals_code_created
  ON public.growth_referrals (referral_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_referrals_campaign_gin
  ON public.growth_referrals USING GIN (campaign);

CREATE TABLE IF NOT EXISTS public.mailing_list_signups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'landing-page',
  referral_code TEXT,
  campaign      JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent    TEXT,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  CONSTRAINT mailing_list_signups_email_unique UNIQUE (email),
  CONSTRAINT mailing_list_signups_email_lower_check CHECK (email = lower(email))
);

CREATE INDEX IF NOT EXISTS idx_mailing_list_signups_created
  ON public.mailing_list_signups (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mailing_list_signups_referral
  ON public.mailing_list_signups (referral_code)
  WHERE referral_code IS NOT NULL;
-- Access Management: role permissions, session tracking, admin settings
-- Promotes database/access_management_schema.sql into a tracked migration.

-- ── Extend roles table ───────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.roles
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS color        TEXT    NOT NULL DEFAULT '#6b7280',
  ADD COLUMN IF NOT EXISTS is_system    BOOLEAN NOT NULL DEFAULT false;

-- Mark existing built-in roles as system (non-deletable)
UPDATE public.roles SET is_system = true, description = 'Full system access',                     color = '#dc2626' WHERE name = 'admin';
UPDATE public.roles SET is_system = true, description = 'MassHealth benefit applicant',            color = '#6b7280' WHERE name = 'applicant';
UPDATE public.roles SET is_system = true, description = 'Licensed social worker / case manager',   color = '#2563eb' WHERE name = 'social_worker';
UPDATE public.roles SET is_system = true, description = 'Case reviewer with read/comment access',  color = '#7c3aed' WHERE name = 'reviewer';

-- Insert new granular roles (idempotent)
INSERT INTO public.roles (name, description, color, is_system)
  VALUES
    ('read_only_staff',  'Read-only access for administrative staff', '#64748b', false),
    ('case_reviewer',    'Reviews and annotates cases; no edits',     '#8b5cf6', false),
    ('supervisor',       'Supervisor: oversees staff and workflows',  '#f59e0b', false)
  ON CONFLICT (name) DO NOTHING;

-- ── Role permissions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name   TEXT    NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
  permission  TEXT    NOT NULL,
  UNIQUE (role_name, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_name);

-- Seed default permissions
INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'admin', unnest(ARRAY[
    'applications.view','applications.edit','applications.delete','applications.export',
    'users.view','users.edit','users.invite','users.bulk',
    'reports.view','reports.export',
    'organizations.view','organizations.edit',
    'social_workers.view','social_workers.edit',
    'admin.roles','admin.sessions'
  ])
  ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'reviewer', unnest(ARRAY[
    'applications.view',
    'users.view',
    'reports.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'read_only_staff', unnest(ARRAY[
    'applications.view',
    'users.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'case_reviewer', unnest(ARRAY[
    'applications.view',
    'users.view',
    'reports.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'supervisor', unnest(ARRAY[
    'applications.view','applications.edit',
    'users.view','users.edit','users.invite',
    'reports.view','reports.export',
    'organizations.view','organizations.edit',
    'social_workers.view','social_workers.edit'
  ])
  ON CONFLICT DO NOTHING;

-- ── Login / session events ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.login_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type   TEXT        NOT NULL DEFAULT 'login',
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_id    ON public.login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON public.login_events(created_at);

-- ── Admin settings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.admin_settings (key, value)
  VALUES
    ('session_timeout_minutes', '60'),
    ('max_sessions_per_user',   '5'),
    ('require_2fa_admin',       'false')
  ON CONFLICT (key) DO NOTHING;

-- ── Extend users table ───────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
-- @author: Bin Lee
-- @email: blee@healthcompass.cloud
--
-- Cross-device document upload sessions
-- Allows a desktop user to scan a QR code with their phone to take a photo
-- and upload a document (Government-Issued ID, Proof of Income, etc.).

CREATE TABLE IF NOT EXISTS public.mobile_upload_sessions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token                   TEXT        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  user_id                 UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  application_id          UUID        NOT NULL,
  document_type           TEXT,
  required_document_label TEXT,
  status                  TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired')),
  -- Populated once the mobile device completes the upload
  document_id             UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at              TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mobile_upload_sessions_token  ON public.mobile_upload_sessions (token);
CREATE INDEX IF NOT EXISTS idx_mobile_upload_sessions_user   ON public.mobile_upload_sessions (user_id, status);

ALTER TABLE public.mobile_upload_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_upload_sessions_owner ON public.mobile_upload_sessions;
CREATE POLICY mobile_upload_sessions_owner ON public.mobile_upload_sessions FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mobile_upload_sessions_staff ON public.mobile_upload_sessions;
CREATE POLICY mobile_upload_sessions_staff ON public.mobile_upload_sessions FOR ALL
  USING (public.is_staff());
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
