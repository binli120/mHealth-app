/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { parseParams, uuidSchema } from "@/lib/api/validation"
import { confirmCustomerReview } from "@/lib/db/application-drafts"
import { logServerError } from "@/lib/server/logger"

const paramsSchema = z.object({ applicationId: uuidSchema })

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireAuthenticatedUser(request)
  if (!authResult.ok) return authResult.response

  const parsedParams = parseParams(await params, paramsSchema)
  if (!parsedParams.ok) return parsedParams.response
  const { applicationId } = parsedParams.data

  try {
    await confirmCustomerReview(applicationId, authResult.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("confirm-review.patch", error, { applicationId })
    return NextResponse.json({ ok: false, error: "Failed to confirm review." }, { status: 500 })
  }
}
