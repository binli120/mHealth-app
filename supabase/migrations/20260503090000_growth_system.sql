-- @author: Bin Lee
-- @email: blee@healthcompass.cloud

-- Growth analytics support: referral attribution and mailing-list capture.
-- These tables intentionally avoid storing PHI or authenticated profile data.

CREATE TABLE IF NOT EXISTS public.growth_referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL,
  landing_path  TEXT NOT NULL,
  referrer      TEXT,
  campaign      JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent    TEXT,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_referrals_code_created
  ON public.growth_referrals (referral_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_referrals_campaign_gin
  ON public.growth_referrals USING GIN (campaign);

CREATE TABLE IF NOT EXISTS public.mailing_list_signups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'landing-page',
  referral_code TEXT,
  campaign      JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent    TEXT,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  CONSTRAINT mailing_list_signups_email_unique UNIQUE (email),
  CONSTRAINT mailing_list_signups_email_lower_check CHECK (email = lower(email))
);

CREATE INDEX IF NOT EXISTS idx_mailing_list_signups_created
  ON public.mailing_list_signups (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mailing_list_signups_referral
  ON public.mailing_list_signups (referral_code)
  WHERE referral_code IS NOT NULL;
