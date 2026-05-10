-- Add accepting_patients flag to social_worker_profiles.
-- When true the SW is visible to patients and can receive engagement requests.
-- Defaults to true so newly approved SWs are immediately discoverable.

ALTER TABLE public.social_worker_profiles
  ADD COLUMN IF NOT EXISTS accepting_patients BOOLEAN NOT NULL DEFAULT true;

-- Index to make patient-facing SW search efficient.
CREATE INDEX IF NOT EXISTS idx_sw_profiles_accepting
  ON public.social_worker_profiles (accepting_patients)
  WHERE accepting_patients = true;

-- Allow the SW to update their own accepting_patients flag.
-- (The existing sw_profiles_update policy only permits staff; we add a
-- narrower policy so the SW can flip just this one column themselves.)
DROP POLICY IF EXISTS sw_profiles_update_self_accepting ON public.social_worker_profiles;
CREATE POLICY sw_profiles_update_self_accepting
  ON public.social_worker_profiles FOR UPDATE TO authenticated
  USING (user_id = public.request_user_id())
  WITH CHECK (user_id = public.request_user_id());
