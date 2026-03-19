import { NextResponse } from "next/server"

import {
  ApplicationDraftAccessError,
  getApplicationDraft,
  upsertApplicationDraft,
} from "@/lib/db/application-drafts"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { notifyStatusChange } from "@/lib/notifications/service"
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{
    applicationId: string
  }>
}

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

export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const { applicationId } = await context.params
    if (!UUID_PATTERN.test(applicationId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId (UUID) is required." },
        { status: STATUS_BAD_REQUEST },
      )
    }

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
    if (!UUID_PATTERN.test(applicationId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId (UUID) is required." },
        { status: STATUS_BAD_REQUEST },
      )
    }

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

    // Fire-and-forget notification on submission
    if (record.status === "submitted") {
      notifyStatusChange(authResult.userId, applicationId, "submitted").catch(() => null)
    }

    return NextResponse.json({
      ok: true,
      record,
    })
  } catch (error) {
    const isAccessError = isApplicationDraftAccessError(error)
    const isValidationError = isInvalidApplicationIdError(error)
    const message =
      process.env.NODE_ENV === NODE_ENV_DEVELOPMENT
        ? error instanceof Error
          ? error.message
          : ERROR_UNKNOWN_SERVER
        : ERROR_SAVE_DRAFT_FAILED

    return NextResponse.json(
      { ok: false, error: message },
      {
        status: isValidationError
          ? STATUS_BAD_REQUEST
          : isAccessError
            ? STATUS_FORBIDDEN
            : STATUS_INTERNAL_SERVER_ERROR,
      },
    )
  }
}
