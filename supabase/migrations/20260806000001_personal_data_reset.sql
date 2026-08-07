-- Permanently erase customer-owned personal data while preserving auth.users,
-- public.users, user_roles, and the credentials required for password login.

-- Direct customer-data writers observe the same advisory lock as the reset.
-- A concurrent background write fails instead of recreating data mid-reset.
CREATE OR REPLACE FUNCTION public.guard_personal_data_reset_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := NULLIF(to_jsonb(NEW) ->> TG_ARGV[0], '')::uuid;
  IF v_user_id IS NOT NULL
     AND NOT pg_try_advisory_xact_lock(hashtextextended(v_user_id::text, 0))
  THEN
    RAISE EXCEPTION 'personal data reset in progress';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_personal_data_reset_write() FROM PUBLIC;

DO $$
DECLARE
  v_target text[];
BEGIN
  FOREACH v_target SLICE 1 IN ARRAY ARRAY[
    ARRAY['users', 'id'], ARRAY['applicants', 'user_id'],
    ARRAY['notifications', 'user_id'], ARRAY['help_questions', 'user_id'],
    ARRAY['help_answers', 'user_id'], ARRAY['insurance_coverage_records', 'user_id'],
    ARRAY['mobile_handoff_sessions', 'user_id'], ARRAY['mobile_upload_sessions', 'user_id'],
    ARRAY['appeal_analyses', 'user_id'], ARRAY['user_agent_memory', 'user_id'],
    ARRAY['identity_verification_attempts', 'user_id'],
    ARRAY['mobile_verify_sessions', 'user_id'], ARRAY['audit_logs', 'user_id'],
    ARRAY['login_events', 'user_id'], ARRAY['revoked_sessions', 'user_id'],
    ARRAY['sw_direct_messages', 'patient_user_id'],
    ARRAY['sw_engagement_requests', 'patient_user_id'],
    ARRAY['patient_social_worker_access', 'patient_user_id'],
    ARRAY['collaborative_sessions', 'patient_user_id']
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS personal_data_reset_write_guard ON public.%I', v_target[1]);
    EXECUTE format(
      'CREATE TRIGGER personal_data_reset_write_guard BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.guard_personal_data_reset_write(%L)',
      v_target[1], v_target[2]
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_customer_personal_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_applicant_id uuid;
  v_application_ids uuid[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id is required';
  END IF;

  -- Serialize retries for a user without blocking resets for other users.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT id INTO v_applicant_id
  FROM public.applicants
  WHERE user_id = p_user_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_application_ids
  FROM public.applications
  WHERE applicant_id = v_applicant_id;

  -- User-owned records that either reference applications with SET NULL or
  -- exist independently from the applicant aggregate.
  DELETE FROM public.insurance_coverage_records WHERE user_id = p_user_id;
  DELETE FROM public.mobile_upload_sessions WHERE user_id = p_user_id;
  DELETE FROM public.appeal_analyses WHERE user_id = p_user_id;
  DELETE FROM public.user_agent_memory WHERE user_id = p_user_id::text;
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.help_answers WHERE user_id = p_user_id;
  DELETE FROM public.help_questions WHERE user_id = p_user_id;
  DELETE FROM public.sw_direct_messages WHERE patient_user_id = p_user_id;
  DELETE FROM public.sw_engagement_requests WHERE patient_user_id = p_user_id;
  DELETE FROM public.patient_social_worker_access WHERE patient_user_id = p_user_id;
  DELETE FROM public.collaborative_sessions WHERE patient_user_id = p_user_id;
  DELETE FROM public.mobile_handoff_sessions WHERE user_id = p_user_id;
  DELETE FROM public.login_events WHERE user_id = p_user_id;
  DELETE FROM public.revoked_sessions WHERE user_id = p_user_id;
  DELETE FROM public.rate_limit_counters WHERE key LIKE '%' || p_user_id::text || '%';

  -- These foreign keys intentionally do not cascade from applications.
  DELETE FROM public.audit_logs
  WHERE user_id = p_user_id OR application_id = ANY(v_application_ids);
  DELETE FROM public.review_actions WHERE application_id = ANY(v_application_ids);
  DELETE FROM public.rfis WHERE application_id = ANY(v_application_ids);

  -- Application children cascade. Applicant children (profile, family,
  -- benefits and identity state) cascade when the applicant is removed.
  DELETE FROM public.applications WHERE id = ANY(v_application_ids);
  DELETE FROM public.applicants WHERE id = v_applicant_id;

  -- Older deployed schemas predate users.avatar_url. Profile avatars are
  -- already removed with user_profiles/storage; clear this optional column
  -- only where it exists so the reset works across supported schema versions.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'avatar_url'
  ) THEN
    EXECUTE 'UPDATE public.users SET avatar_url = NULL, last_active_at = NULL WHERE id = $1'
      USING p_user_id;
  ELSE
    UPDATE public.users SET last_active_at = NULL WHERE id = p_user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.applicants WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.notifications WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.insurance_coverage_records WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.user_agent_memory WHERE user_id = p_user_id::text)
     OR EXISTS (SELECT 1 FROM public.help_questions WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.help_answers WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.sw_direct_messages WHERE patient_user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.sw_engagement_requests WHERE patient_user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.patient_social_worker_access WHERE patient_user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.collaborative_sessions WHERE patient_user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.mobile_handoff_sessions WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.mobile_upload_sessions WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.appeal_analyses WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.login_events WHERE user_id = p_user_id)
  THEN
    RAISE EXCEPTION 'personal data reset verification failed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_customer_personal_data(uuid) FROM PUBLIC;
COMMENT ON FUNCTION public.reset_customer_personal_data(uuid) IS
  'Server-only, idempotent customer data reset. Preserves auth identity, public.users, and user_roles.';
