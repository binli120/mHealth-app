/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { updateApplicantInfo } from "@/lib/db/user-profile"
import {
  ERROR_USER_PROFILE_NOT_FOUND,
  ERROR_USER_PROFILE_SAVE_FAILED,
  ERROR_USER_PROFILE_INVALID_PAYLOAD,
  ERROR_USER_PROFILE_LOG_PREFIX,
} from "@/lib/user-profile/constants"

export const runtime = "nodejs"

const applicantSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s\-().+]{7,20}$/, "Invalid phone number format")
    .optional(),
  addressLine1: z.string().trim().min(1).max(120).optional(),
  addressLine2: z.string().trim().max(60).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  state: z.string().trim().length(2).optional(),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code")
    .optional(),
})

export async function PUT(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = (await request.json().catch(() => null)) as unknown
    const parsed = applicantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: ERROR_USER_PROFILE_INVALID_PAYLOAD }, { status: 400 })
    }

    await updateApplicantInfo(authResult.userId, parsed.data)
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    logServerError(ERROR_USER_PROFILE_LOG_PREFIX, error, { route: "PUT /api/user-profile/applicant" })
    const status =
      error instanceof Error && error.message.includes("not found") ? 404 : 500
    const message =
      error instanceof Error && error.message.includes("not found")
        ? ERROR_USER_PROFILE_NOT_FOUND
        : ERROR_USER_PROFILE_SAVE_FAILED
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
