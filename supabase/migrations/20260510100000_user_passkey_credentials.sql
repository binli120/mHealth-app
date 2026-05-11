-- Passkey (WebAuthn) credentials for regular users (patients / applicants).
-- Mirrors the admin_passkey_credentials table but is scoped to all authenticated
-- users, not just admins.

CREATE TABLE IF NOT EXISTS public.user_passkey_credentials (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id  TEXT        NOT NULL UNIQUE,
  public_key     TEXT        NOT NULL,
  counter        BIGINT      NOT NULL DEFAULT 0,
  transports     TEXT[]      NOT NULL DEFAULT '{}',
  device_type    TEXT        NOT NULL DEFAULT 'singleDevice',
  backed_up      BOOLEAN     NOT NULL DEFAULT false,
  name           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON public.user_passkey_credentials(user_id);

ALTER TABLE public.user_passkey_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only read and manage their own passkeys.
CREATE POLICY user_passkeys_select
  ON public.user_passkey_credentials FOR SELECT TO authenticated
  USING (user_id = public.request_user_id() OR public.is_staff());

CREATE POLICY user_passkeys_insert
  ON public.user_passkey_credentials FOR INSERT TO authenticated
  WITH CHECK (user_id = public.request_user_id());

CREATE POLICY user_passkeys_delete
  ON public.user_passkey_credentials FOR DELETE TO authenticated
  USING (user_id = public.request_user_id());
