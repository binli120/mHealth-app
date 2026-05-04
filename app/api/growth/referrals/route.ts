import { NextResponse } from "next/server"
import { z } from "zod"

import { createReferralEvent } from "@/lib/db/growth"
import { getClientIpHash, getUserAgent } from "@/lib/growth/request"
import { logServerError } from "@/lib/server/logger"

export const runtime = "nodejs"

const referralSchema = z.object({
  referralCode: z.string().trim().min(2).max(128),
  landingPath: z.string().trim().min(1).max(2048),
  referrer: z.string().trim().max(2048).nullable().optional(),
  campaign: z.record(z.string().trim().max(256)).optional().default({}),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = referralSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid referral payload" }, { status: 400 })
  }

  try {
    await createReferralEvent({
      referralCode: parsed.data.referralCode,
      landingPath: parsed.data.landingPath,
      referrer: parsed.data.referrer ?? null,
      campaign: parsed.data.campaign,
      userAgent: getUserAgent(request),
      ipHash: getClientIpHash(request),
    })

    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (error) {
    logServerError("growth.referral.write_failed", error, {
      route: "/api/growth/referrals",
      referralCode: parsed.data.referralCode,
    })
    return NextResponse.json({ ok: false, error: "Referral could not be recorded" }, { status: 500 })
  }
}
