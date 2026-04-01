BEGIN;

DROP POLICY IF EXISTS sessions_insert ON public.collaborative_sessions;

CREATE POLICY sessions_insert
  ON public.collaborative_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    OR (
      sw_user_id = public.request_user_id()
      AND EXISTS (
        SELECT 1
        FROM public.patient_social_worker_access psa
        WHERE psa.patient_user_id = collaborative_sessions.patient_user_id
          AND psa.social_worker_user_id = collaborative_sessions.sw_user_id
          AND psa.is_active = true
      )
    )
  );

COMMIT;
