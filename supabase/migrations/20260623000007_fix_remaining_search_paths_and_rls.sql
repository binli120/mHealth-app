-- Batch fix for remaining mutable search_path functions and permissive INSERT policies.

-- ── 1. search_path fixes ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.set_session_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.update_family_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.check_admin_social_worker_exclusivity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.purge_expired_rate_limit_counters()
RETURNS void LANGUAGE sql SET search_path = public AS $$
  DELETE FROM public.rate_limit_counters
  WHERE window_start < (now() - interval '2 hours');
$$;

-- handle_new_user: SECURITY DEFINER but missing search_path (re-declared in 20260529 migration)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 2. Tighten mailing_list_signups INSERT policy ────────────────────────────
-- Same pattern as growth_referrals (fixed in 20260623000006): public inserts
-- are intentional for landing-page signups, but WITH CHECK (true) is too broad.
DROP POLICY IF EXISTS mls_insert_public ON public.mailing_list_signups;
CREATE POLICY mls_insert_public ON public.mailing_list_signups
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(email) <= 254
    AND source <> ''
    AND length(source) <= 128
  );
