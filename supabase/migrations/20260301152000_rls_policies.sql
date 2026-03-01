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
