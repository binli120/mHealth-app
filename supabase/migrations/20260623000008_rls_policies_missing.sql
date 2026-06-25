-- Add missing RLS policies for tables that had RLS enabled but no policies.
-- Without any policy, RLS defaults to DENY ALL — these tables were effectively
-- inaccessible to all roles except service_role. This migration makes the
-- intent explicit and allows the correct access patterns.

-- ── rate_limit_counters ───────────────────────────────────────────────────────
-- Server-only table. All reads/writes happen via service_role (bypasses RLS)
-- or the purge function. No direct access for authenticated or anon users.
-- Explicit deny policy makes the intent clear and satisfies the linter.
CREATE POLICY rlc_deny_all ON public.rate_limit_counters
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false);

-- ── feature_flags ─────────────────────────────────────────────────────────────
-- Authenticated users read feature flags to gate UI features.
-- Writes are admin-only via service_role (migrations / admin tooling).
CREATE POLICY ff_select_authenticated ON public.feature_flags
  FOR SELECT TO authenticated
  USING (true);

-- ── feature_flag_env_overrides ────────────────────────────────────────────────
-- Same access model as feature_flags: read by authenticated, write via service_role.
CREATE POLICY ffeo_select_authenticated ON public.feature_flag_env_overrides
  FOR SELECT TO authenticated
  USING (true);

-- ── glossary_terms ────────────────────────────────────────────────────────────
-- Public reference data used in chat, benefits, and the glossary UI.
-- Reads are open to authenticated users; writes go through server-only db.ts
-- using the service_role connection pool (bypasses RLS).
CREATE POLICY gt_select_authenticated ON public.glossary_terms
  FOR SELECT TO authenticated
  USING (true);

-- ── mh_appeal_source_documents ────────────────────────────────────────────────
-- AI/policy reference data queried by the appeal assistant server action.
-- The appeal assistant runs server-side with service_role and bypasses RLS,
-- but authenticated users may also read these via the Supabase client for
-- document previews in the appeal UI.
CREATE POLICY mhasd_select_authenticated ON public.mh_appeal_source_documents
  FOR SELECT TO authenticated
  USING (true);

-- ── mh_appeal_source_chunks ───────────────────────────────────────────────────
-- Embedding chunks for vector search — only accessed server-side via
-- service_role. No direct client access needed; deny to reduce attack surface.
CREATE POLICY mhasc_deny_direct ON public.mh_appeal_source_chunks
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false);

-- ── mh_denial_patterns ───────────────────────────────────────────────────────
-- Reference patterns for the denial categoriser — server-side only via
-- service_role. Deny direct client access.
CREATE POLICY mhdp_deny_direct ON public.mh_denial_patterns
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false);
