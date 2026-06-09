/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { confirmCustomerReview } from "@/lib/db/application-drafts"

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const { applicationId } = await params

  try {
    await confirmCustomerReview(applicationId, authResult.userId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to confirm review." }, { status: 500 })
  }
}
