-- ============================================================
-- Invitations schema
-- Admin can invite users by email, optionally linked to a company.
-- The invited user receives a link to set their name + password.
-- @author Bin Lee
-- @email blee@healthcompass.cloud
-- ============================================================

-- Add company_id to public.users so members can be linked to a company
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_id UUID
    REFERENCES public.companies(id) ON DELETE SET NULL;

-- Invitations table
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

-- RLS: admins can manage invitations; row is readable by anyone who has the token
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_invitations" ON public.invitations
  FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
