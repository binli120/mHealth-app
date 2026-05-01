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
