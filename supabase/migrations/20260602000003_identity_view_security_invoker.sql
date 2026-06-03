-- Switch identity_pending_review to security_invoker so it respects the
-- querying user's RLS policies rather than the view owner's (which would
-- bypass RLS on the underlying applicants and identity_verification_attempts tables).
ALTER VIEW public.identity_pending_review SET (security_invoker = true);
