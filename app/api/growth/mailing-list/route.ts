/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { z } from "zod"

import { upsertMailingListSignup } from "@/lib/db/growth"
import { getClientIpHash, getUserAgent, readReferralCookie } from "@/lib/growth/request"
import { logServerError, logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

const signupSchema = z.object({
  email: z.string().trim().email().max(254),
  source: z.string().trim().min(1).max(128).optional().default("landing-page"),
  referralCode: z.string().trim().min(2).max(128).nullable().optional(),
  campaign: z.record(z.string().trim().max(256)).optional().default({}),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = signupSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase()
  const referralCode = parsed.data.referralCode ?? readReferralCookie(request)

  try {
    await upsertMailingListSignup({
      email,
      source: parsed.data.source,
      referralCode,
      campaign: parsed.data.campaign,
      userAgent: getUserAgent(request),
      ipHash: getClientIpHash(request),
    })

    logServerInfo("growth.mailing_list.signup", {
      source: parsed.data.source,
      hasReferral: Boolean(referralCode),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("growth.mailing_list.write_failed", error, {
      route: "/api/growth/mailing-list",
      source: parsed.data.source,
    })
    return NextResponse.json({ ok: false, error: "Signup could not be saved." }, { status: 500 })
  }
}
