-- Revoke default PUBLIC execute on SECURITY DEFINER helper functions.
-- By default Postgres grants EXECUTE to PUBLIC (which includes the anon role),
-- making these callable unauthenticated via /rest/v1/rpc/*.
-- These functions are only needed inside RLS policies (server-side), not as
-- public RPC endpoints, so we restrict them to authenticated users and the
-- service role only.

REVOKE EXECUTE ON FUNCTION public.request_user_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.request_user_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_user(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_user(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_applicant(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_applicant(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_application(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_application(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_document(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_document(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_organization(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_organization(uuid) TO authenticated, service_role;
