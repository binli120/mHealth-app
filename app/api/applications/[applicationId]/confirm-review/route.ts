/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { confirmCustomerReview } from "@/lib/db/application-drafts"
import { logServerError } from "@/lib/server/logger"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const { applicationId } = await params

  if (!UUID_PATTERN.test(applicationId)) {
    return NextResponse.json({ ok: false, error: "Invalid applicationId." }, { status: 400 })
  }

  try {
    await confirmCustomerReview(applicationId, authResult.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("confirm-review.patch", error, { applicationId })
    return NextResponse.json({ ok: false, error: "Failed to confirm review." }, { status: 500 })
  }
}
