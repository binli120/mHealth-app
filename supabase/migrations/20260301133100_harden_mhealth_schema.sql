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
