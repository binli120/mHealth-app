CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL -- applicant, reviewer, admin
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  first_name TEXT,
  last_name TEXT,
  dob DATE,
  ssn_encrypted TEXT, -- encrypted at app layer
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  citizenship_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE application_status AS ENUM (
  'draft',
  'submitted',
  'ai_extracted',
  'needs_review',
  'rfi_requested',
  'approved',
  'denied'
);

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  applicant_id UUID REFERENCES applicants(id),
  status application_status NOT NULL DEFAULT 'draft',
  household_size INT,
  total_monthly_income NUMERIC(12,2),
  confidence_score NUMERIC(5,2),
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT applications_household_size_check
    CHECK (household_size IS NULL OR household_size >= 1),
  CONSTRAINT applications_total_monthly_income_non_negative
    CHECK (total_monthly_income IS NULL OR total_monthly_income >= 0),
  CONSTRAINT applications_confidence_score_range
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))
);

CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  dob DATE,
  relationship TEXT,
  pregnant BOOLEAN NOT NULL DEFAULT false,
  disabled BOOLEAN NOT NULL DEFAULT false,
  over_65 BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT household_members_id_application_id_key UNIQUE (id, application_id)
);

CREATE TABLE incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  member_id UUID REFERENCES household_members(id),
  income_type TEXT, -- employment, SSA, self_employed
  employer_name TEXT,
  monthly_amount NUMERIC(12,2),
  verified BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT incomes_monthly_amount_non_negative
    CHECK (monthly_amount IS NULL OR monthly_amount >= 0),
  CONSTRAINT incomes_member_application_fk
    FOREIGN KEY (member_id, application_id)
    REFERENCES household_members(id, application_id)
    ON DELETE CASCADE
);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  asset_type TEXT,
  value NUMERIC(14,2),
  CONSTRAINT assets_value_non_negative
    CHECK (value IS NULL OR value >= 0)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  document_type TEXT, -- paystub, id, utility_bill
  file_url TEXT NOT NULL,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INT,
  ocr_text TEXT,
  CONSTRAINT document_pages_page_number_check
    CHECK (page_number IS NULL OR page_number > 0),
  CONSTRAINT document_pages_document_id_page_number_key
    UNIQUE (document_id, page_number)
);

CREATE TABLE document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  model_name TEXT,
  raw_output JSONB,
  structured_output JSONB,
  confidence_score NUMERIC(5,2),
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_extractions_confidence_score_range
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))
);

CREATE TABLE validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  rule_name TEXT,
  severity TEXT, -- warning, error
  message TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT validation_results_severity_check
    CHECK (severity IS NULL OR severity IN ('warning', 'error'))
);

CREATE TABLE eligibility_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  estimated_program TEXT,
  fpl_percentage NUMERIC(6,2),
  screening_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT eligibility_screenings_fpl_non_negative
    CHECK (fpl_percentage IS NULL OR fpl_percentage >= 0)
);

CREATE TABLE review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  reviewer_id UUID REFERENCES users(id),
  action_type TEXT, -- approve, deny, rfi
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_actions_action_type_check
    CHECK (action_type IS NULL OR action_type IN ('approve', 'deny', 'rfi'))
);

CREATE TABLE rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  requested_by UUID REFERENCES users(id),
  message TEXT,
  due_date DATE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  action TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

CREATE INDEX idx_application_status ON applications(status);
CREATE INDEX idx_applications_organization_id ON applications(organization_id);
CREATE INDEX idx_applications_applicant_id ON applications(applicant_id);

CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_applicants_user_id ON applicants(user_id);

CREATE INDEX idx_household_members_application_id ON household_members(application_id);
CREATE INDEX idx_incomes_application_id ON incomes(application_id);
CREATE INDEX idx_incomes_member_id ON incomes(member_id);
CREATE INDEX idx_assets_application_id ON assets(application_id);

CREATE INDEX idx_documents_application ON documents(application_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX idx_document_extractions_document_id ON document_extractions(document_id);
CREATE INDEX idx_extraction_json ON document_extractions USING GIN (structured_output);

CREATE INDEX idx_validation_application ON validation_results(application_id);
CREATE INDEX idx_eligibility_screenings_application_id ON eligibility_screenings(application_id);
CREATE INDEX idx_review_actions_application_id ON review_actions(application_id);
CREATE INDEX idx_review_actions_reviewer_id ON review_actions(reviewer_id);
CREATE INDEX idx_rfis_application_id ON rfis(application_id);
CREATE INDEX idx_rfis_requested_by ON rfis(requested_by);

CREATE INDEX idx_audit_application ON audit_logs(application_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

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

CREATE POLICY roles_select
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

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

CREATE POLICY household_members_owner_rw
  ON public.household_members
  FOR ALL
  TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

CREATE POLICY incomes_owner_rw
  ON public.incomes
  FOR ALL
  TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

CREATE POLICY assets_owner_rw
  ON public.assets
  FOR ALL
  TO authenticated
  USING (public.can_access_application(application_id))
  WITH CHECK (public.can_access_application(application_id));

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
