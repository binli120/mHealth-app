/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"
import { z } from "zod"

import { APPLICATION_STATUSES } from "@/lib/application-status"
import { parseJsonBody, parseQuery, uuidSchema } from "@/lib/api/validation"
import {
  ApplicationDraftAccessError,
  createApplicationDraft,
  listApplicationDrafts,
} from "@/lib/db/application-drafts"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

const listQuerySchema = z.object({
  status: z.union([z.enum(APPLICATION_STATUSES), z.literal("")]).optional(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
})

const createBodySchema = z.object({
  applicationId: uuidSchema,
  applicationType: z.string().trim().optional(),
})

function isApplicationDraftAccessError(error: unknown): boolean {
  return (
    error instanceof ApplicationDraftAccessError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "ApplicationDraftAccessError")
  )
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const parsedQuery = parseQuery(searchParams, listQuerySchema)
    if (!parsedQuery.ok) return parsedQuery.response
    const { status, q, limit, offset } = parsedQuery.data

    const { records, total } = await listApplicationDrafts(authResult.userId, {
      status: status || null,
      query: q,
      limit,
      offset,
    })

    return NextResponse.json({
      ok: true,
      records,
      total,
    })
  } catch (error) {
    const isAccessError = isApplicationDraftAccessError(error)
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown server error"
        : "Failed to list applications"

    return NextResponse.json(
      { ok: false, error: message },
      { status: isAccessError ? 403 : 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const parsedBody = await parseJsonBody(request, createBodySchema)
    if (!parsedBody.ok) return parsedBody.response
    const { applicationId, applicationType } = parsedBody.data

    const actingFor = request.headers.get("X-Acting-For-Patient") ?? undefined
    const record = await createApplicationDraft({
      userId: authResult.userId,
      applicationId,
      applicationType,
      actingForUserId: actingFor,
    })

    return NextResponse.json({
      ok: true,
      applicationId: record.id,
      record,
    })
  } catch (error) {
    const isAccessError = isApplicationDraftAccessError(error)
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown server error"
        : "Failed to create application"

    return NextResponse.json(
      { ok: false, error: message },
      { status: isAccessError ? 403 : 500 },
    )
  }
}
