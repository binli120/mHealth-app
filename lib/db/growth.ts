/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"

export interface ReferralInput {
  referralCode: string
  landingPath: string
  referrer: string | null
  campaign: Record<string, string>
  userAgent: string | null
  ipHash: string | null
}

export interface MailingListSignupInput {
  email: string
  source: string
  referralCode: string | null
  campaign: Record<string, string>
  userAgent: string | null
  ipHash: string | null
}

export async function createReferralEvent(input: ReferralInput) {
  const pool = getDbPool()
  await pool.query(
    `
      INSERT INTO public.growth_referrals (
        referral_code,
        landing_path,
        referrer,
        campaign,
        user_agent,
        ip_hash
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `,
    [
      input.referralCode,
      input.landingPath,
      input.referrer,
      JSON.stringify(input.campaign),
      input.userAgent,
      input.ipHash,
    ],
  )
}

export async function upsertMailingListSignup(input: MailingListSignupInput) {
  const pool = getDbPool()
  await pool.query(
    `
      INSERT INTO public.mailing_list_signups (
        email,
        source,
        referral_code,
        campaign,
        user_agent,
        ip_hash
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        source = EXCLUDED.source,
        referral_code = COALESCE(EXCLUDED.referral_code, public.mailing_list_signups.referral_code),
        campaign = public.mailing_list_signups.campaign || EXCLUDED.campaign,
        user_agent = EXCLUDED.user_agent,
        ip_hash = EXCLUDED.ip_hash,
        updated_at = now()
    `,
    [
      input.email,
      input.source,
      input.referralCode,
      JSON.stringify(input.campaign),
      input.userAgent,
      input.ipHash,
    ],
  )
}
