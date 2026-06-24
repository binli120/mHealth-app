-- Tighten gr_insert_public: replace WITH CHECK (true) with meaningful
-- field constraints. Public inserts are intentional (unauthenticated visitors
-- record referral clicks), but we constrain what can be written to prevent
-- junk data injection and abuse of the open insert policy.
DROP POLICY IF EXISTS gr_insert_public ON public.growth_referrals;
CREATE POLICY gr_insert_public ON public.growth_referrals
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    referral_code <> ''
    AND length(referral_code) <= 128
    AND landing_path <> ''
    AND length(landing_path) <= 512
  );
