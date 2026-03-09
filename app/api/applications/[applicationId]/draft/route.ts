import { NextResponse } from "next/server"

import {
  ApplicationDraftAccessError,
  getApplicationDraft,
  upsertApplicationDraft,
} from "@/lib/db/application-drafts"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  ERROR_APPLICATION_DRAFT_NOT_FOUND,
  ERROR_LOAD_DRAFT_FAILED,
  ERROR_SAVE_DRAFT_FAILED,
  ERROR_UNKNOWN_SERVER,
  ERROR_WIZARD_STATE_REQUIRED,
  NODE_ENV_DEVELOPMENT,
  STATUS_BAD_REQUEST,
  STATUS_FORBIDDEN,
  STATUS_INTERNAL_SERVER_ERROR,
  STATUS_NOT_FOUND,
} from "./constants"

interface RouteContext {
  params: Promise<{
    applicationId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const { applicationId } = await context.params
    const record = await getApplicationDraft(authResult.userId, applicationId)
    if (!record) {
      return NextResponse.json(
        {
          ok: false,
          error: ERROR_APPLICATION_DRAFT_NOT_FOUND,
        },
        { status: STATUS_NOT_FOUND },
      )
    }

    return NextResponse.json({
      ok: true,
      record,
      draftState: record.draftState,
    })
  } catch (error) {
    const message =
      process.env.NODE_ENV === NODE_ENV_DEVELOPMENT
        ? error instanceof Error
          ? error.message
          : ERROR_UNKNOWN_SERVER
        : ERROR_LOAD_DRAFT_FAILED

    return NextResponse.json({ ok: false, error: message }, { status: STATUS_INTERNAL_SERVER_ERROR })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const { applicationId } = await context.params
    const body = (await request.json()) as {
      applicationType?: string
      wizardState?: Record<string, unknown>
    }

    if (!body.wizardState || typeof body.wizardState !== "object") {
      return NextResponse.json(
        { ok: false, error: ERROR_WIZARD_STATE_REQUIRED },
        { status: STATUS_BAD_REQUEST },
      )
    }

    const record = await upsertApplicationDraft({
      userId: authResult.userId,
      applicationId,
      applicationType: body.applicationType,
      wizardState: body.wizardState,
    })

    return NextResponse.json({
      ok: true,
      record,
    })
  } catch (error) {
    const isAccessError = error instanceof ApplicationDraftAccessError
    const message =
      process.env.NODE_ENV === NODE_ENV_DEVELOPMENT
        ? error instanceof Error
          ? error.message
          : ERROR_UNKNOWN_SERVER
        : ERROR_SAVE_DRAFT_FAILED

    return NextResponse.json({ ok: false, error: message }, { status: isAccessError ? STATUS_FORBIDDEN : STATUS_INTERNAL_SERVER_ERROR })
  }
}
