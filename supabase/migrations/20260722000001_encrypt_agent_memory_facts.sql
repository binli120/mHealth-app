-- supabase/migrations/20260722000001_encrypt_agent_memory_facts.sql
--
-- extracted_facts (age, income, citizenship status, disability, pregnancy,
-- Medicare, employer insurance) is PHI per HIPAA_COMPLIANCE.md's PHI
-- inventory. It was stored as plaintext jsonb. Add an encrypted column
-- following the *_encrypted TEXT convention used elsewhere (baseline_schema
-- applicants table); application code now writes AES-256-GCM ciphertext here
-- instead of the plaintext jsonb column.
--
-- Additive + idempotent: safe to run multiple times. The old extracted_facts
-- column is left in place (nullable going forward) so any pre-existing rows
-- keep decrypting cleanly via the legacy fallback in lib/agents/memory/load.ts
-- until they are naturally overwritten by a fresh merge-and-save.

BEGIN;

ALTER TABLE public.user_agent_memory
  ALTER COLUMN extracted_facts DROP NOT NULL,
  ALTER COLUMN extracted_facts DROP DEFAULT;

ALTER TABLE public.user_agent_memory
  ADD COLUMN IF NOT EXISTS extracted_facts_encrypted TEXT;

COMMENT ON COLUMN public.user_agent_memory.extracted_facts_encrypted IS
  'AES-256-GCM ciphertext (lib/user-profile/encrypt.ts) of the JSON-stringified '
  'extracted_facts payload. Replaces the plaintext extracted_facts column for '
  'all new writes.';

COMMENT ON COLUMN public.user_agent_memory.extracted_facts IS
  'Deprecated plaintext column, retained only so pre-encryption rows keep '
  'decrypting until overwritten. Do not write to this column.';

COMMIT;
