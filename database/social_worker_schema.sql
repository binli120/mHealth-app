/**
 * Social Worker, Companies, and Patient Access Schema
 * Run after mHealth_schema.sql
 * @author Bin Lee
 */

-- Add social_worker role
INSERT INTO public.roles (name) VALUES ('social_worker') ON CONFLICT (name) DO NOTHING;

-- Companies / social work agencies
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  npi TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email_domain TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id)
);

-- Social worker profiles (one per user)
-- Identity fields (first_name, last_name, phone, bio, avatar_url) live here —
-- NOT in the applicants table, which is strictly for patients.
CREATE TABLE IF NOT EXISTS public.social_worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  -- Personal identity — kept separate from the patient applicants table
  first_name TEXT,
  last_name  TEXT,
  phone      TEXT,
  bio        TEXT,
  avatar_url TEXT,
  -- Professional info
  license_number TEXT,
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id)
);

-- Patient grants access to a social worker
CREATE TABLE IF NOT EXISTS public.patient_social_worker_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  social_worker_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(patient_user_id, social_worker_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_user ON public.social_worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_company ON public.social_worker_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_status ON public.social_worker_profiles(status);
CREATE INDEX IF NOT EXISTS idx_sw_profiles_name ON public.social_worker_profiles(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_sw_access_patient ON public.patient_social_worker_access(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_access_sw ON public.patient_social_worker_access(social_worker_user_id);
CREATE INDEX IF NOT EXISTS idx_sw_access_active ON public.patient_social_worker_access(is_active);

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_social_worker_access ENABLE ROW LEVEL SECURITY;

-- Companies: anyone authenticated can read approved; only staff can write
CREATE POLICY companies_select_approved
  ON public.companies FOR SELECT TO authenticated
  USING (status = 'approved' OR public.is_staff());

CREATE POLICY companies_write_staff
  ON public.companies FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- SW profiles: user can read own; staff can read all; staff can write
CREATE POLICY sw_profiles_select
  ON public.social_worker_profiles FOR SELECT TO authenticated
  USING (user_id = public.request_user_id() OR public.is_staff());

CREATE POLICY sw_profiles_insert
  ON public.social_worker_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = public.request_user_id() OR public.is_staff());

CREATE POLICY sw_profiles_update
  ON public.social_worker_profiles FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Patient SW access: patient or SW can read; patient inserts/deletes own records
CREATE POLICY sw_access_select
  ON public.patient_social_worker_access FOR SELECT TO authenticated
  USING (
    patient_user_id = public.request_user_id()
    OR social_worker_user_id = public.request_user_id()
    OR public.is_staff()
  );

CREATE POLICY sw_access_insert
  ON public.patient_social_worker_access FOR INSERT TO authenticated
  WITH CHECK (patient_user_id = public.request_user_id() OR public.is_staff());

CREATE POLICY sw_access_update
  ON public.patient_social_worker_access FOR UPDATE TO authenticated
  USING (patient_user_id = public.request_user_id() OR public.is_staff())
  WITH CHECK (patient_user_id = public.request_user_id() OR public.is_staff());
