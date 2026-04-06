-- Invitations schema — depends on companies (20260323)
-- @author Bin Lee

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
