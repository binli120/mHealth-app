-- Add phi_draft_resume_id and phi_draft_key_enc to applications.
--
-- Stores the Supabase Storage lookup key for the encrypted PHI draft blob and
-- an encrypted copy of the AES key for account-bound auto-resume. The server
-- never stores plaintext PHI; the AES key is itself encrypted with the
-- application PHI encryption layer.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS phi_draft_resume_id UUID,
  ADD COLUMN IF NOT EXISTS phi_draft_key_enc   TEXT;

COMMENT ON COLUMN public.applications.phi_draft_resume_id IS
  'Supabase Storage lookup UUID for the encrypted PHI draft blob. '
  'NULL means no encrypted draft has been saved.';

COMMENT ON COLUMN public.applications.phi_draft_key_enc IS
  'Server-encrypted AES key for account-bound PHI draft auto-resume. '
  'The value must decrypt to the client-side AES key; plaintext PHI is never stored here.';
