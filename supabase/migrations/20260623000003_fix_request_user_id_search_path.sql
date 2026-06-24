-- Fix mutable search_path on request_user_id.
-- This function is used extensively in RLS policies; pinning search_path
-- prevents schema-injection attacks that could bypass row-level security.
CREATE OR REPLACE FUNCTION public.request_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
