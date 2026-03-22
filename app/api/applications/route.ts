/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"

import {
  ApplicationDraftAccessError,
  createApplicationDraft,
  listApplicationDrafts,
} from "@/lib/db/application-drafts"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isApplicationDraftAccessError(error: unknown): boolean {
  return (
    error instanceof ApplicationDraftAccessError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "ApplicationDraftAccessError")
  )
}

function isInvalidApplicationIdError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Invalid applicationId")
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const query = searchParams.get("q")
    const limitRaw = searchParams.get("limit")
    const offsetRaw = searchParams.get("offset")

    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined
    const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : undefined

    const { records, total } = await listApplicationDrafts(authResult.userId, {
      status,
      query,
      limit,
      offset,
    })

    return NextResponse.json({
      ok: true,
      records,
      total,
    })
  } catch (error) {
    const isValidationError = error instanceof Error && error.message === "Invalid status filter."
    const isAccessError = isApplicationDraftAccessError(error)
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown server error"
        : "Failed to list applications"

    return NextResponse.json(
      { ok: false, error: message },
      { status: isValidationError ? 400 : isAccessError ? 403 : 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const body = (await request.json().catch(() => ({}))) as {
      applicationId?: string
      applicationType?: string
    }

    const requestedId = body.applicationId?.trim()
    if (!requestedId || !UUID_PATTERN.test(requestedId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId (UUID) is required." },
        { status: 400 },
      )
    }

    const actingFor = request.headers.get("X-Acting-For-Patient") ?? undefined
    const record = await createApplicationDraft({
      userId: authResult.userId,
      applicationId: requestedId,
      applicationType: body.applicationType,
      actingForUserId: actingFor,
    })

    return NextResponse.json({
      ok: true,
      applicationId: record.id,
      record,
    })
  } catch (error) {
    const isAccessError = isApplicationDraftAccessError(error)
    const isValidationError = isInvalidApplicationIdError(error)
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown server error"
        : "Failed to create application"

    return NextResponse.json(
      { ok: false, error: message },
      { status: isValidationError ? 400 : isAccessError ? 403 : 500 },
    )
  }
}
