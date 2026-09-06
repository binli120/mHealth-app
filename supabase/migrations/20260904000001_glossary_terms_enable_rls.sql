-- =============================================================================
-- Migration: enable RLS on glossary_terms
--
-- 20260623000008_rls_policies_missing.sql added the `gt_select_authenticated`
-- policy to glossary_terms but never enabled RLS on the table itself, leaving
-- it fully exposed to anon/authenticated despite the policy existing. Found
-- by the Supabase security advisor (policy_exists_rls_disabled /
-- rls_disabled_in_public) while provisioning the prod project 2026-09-04.
--
-- Safe to run: the SELECT policy already exists, so enabling RLS here does
-- not change read access, it just starts enforcing it.
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op if already enabled.
-- =============================================================================

ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;
