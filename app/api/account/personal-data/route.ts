import { NextResponse } from "next/server"
import { createHash } from "node:crypto"

import { resetPersonalData } from "@/lib/account/delete-personal-data"
import { PERSONAL_DATA_CONFIRMATION_PHRASE } from "@/lib/account/personal-data-contract"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { assertCustomerRole } from "@/lib/db/personal-data-reset"
import { logServerError } from "@/lib/server/logger"
import {
  checkRateLimitAsync,
  personalDataResetLimiter,
} from "@/lib/server/rate-limit"

export const runtime = "nodejs"

export async function DELETE(request: Request) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid confirmation." }, { status: 400 })
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("confirmation" in body) ||
    body.confirmation !== PERSONAL_DATA_CONFIRMATION_PHRASE
  ) {
    return NextResponse.json({ ok: false, error: "Invalid confirmation." }, { status: 400 })
  }

  try {
    if (!(await assertCustomerRole(authResult.userId))) {
      return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 })
    }

    const limited = await checkRateLimitAsync(
      personalDataResetLimiter,
      `personal-data-reset:${createHash("sha256").update(authResult.userId).digest("hex")}`,
    )
    if (limited) return limited

    await resetPersonalData(authResult.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("Personal data reset failed", new Error("Personal data reset failed."), {
      route: "DELETE /api/account/personal-data",
      userId: authResult.userId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    })
    return NextResponse.json(
      { ok: false, error: "Unable to delete personal data. Please try again." },
      { status: 500 },
    )
  }
}
