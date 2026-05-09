/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"

import { requireReviewer } from "@/lib/auth/require-reviewer"
import { getDbPool } from "@/lib/db/server"
import { logServerError } from "@/lib/server/logger"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized) return null
  return normalized.slice(0, maxLength)
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = new Date(`${value.trim()}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return value.trim().slice(0, 10)
}

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireReviewer(request)
  if (!authResult.ok) return authResult.response

  const { applicationId } = await context.params
  if (!UUID_PATTERN.test(applicationId)) {
    return NextResponse.json(
      { ok: false, error: "applicationId must be a valid UUID." },
      { status: 400 },
    )
  }

  let body: { message?: unknown; dueDate?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  const message = normalizeText(body.message, 4000)
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "message is required." },
      { status: 400 },
    )
  }

  const dueDate = normalizeDate(body.dueDate)
  const pool = getDbPool()
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const currentResult = await client.query<{ status: string }>(
      `
        SELECT status::text AS status
        FROM public.applications
        WHERE id = $1::uuid
        FOR UPDATE
      `,
      [applicationId],
    )

    const previous = currentResult.rows[0]
    if (!previous) {
      await client.query("ROLLBACK")
      return NextResponse.json(
        { ok: false, error: "Application not found." },
        { status: 404 },
      )
    }

    await client.query(
      `
        UPDATE public.applications
        SET status = 'rfi_requested'::application_status
        WHERE id = $1::uuid
      `,
      [applicationId],
    )

    const rfiResult = await client.query<{ id: string }>(
      `
        INSERT INTO public.rfis (application_id, requested_by, message, due_date)
        VALUES ($1::uuid, $2::uuid, $3, $4::date)
        RETURNING id::text
      `,
      [applicationId, authResult.userId, message, dueDate],
    )

    await client.query(
      `
        INSERT INTO public.review_actions (application_id, reviewer_id, action_type, notes)
        VALUES ($1::uuid, $2::uuid, 'rfi', $3)
      `,
      [applicationId, authResult.userId, message],
    )

    await client.query(
      `
        INSERT INTO public.audit_logs (user_id, application_id, action, old_data, new_data)
        VALUES (
          $1::uuid,
          $2::uuid,
          'application.rfi_requested',
          $3::jsonb,
          $4::jsonb
        )
      `,
      [
        authResult.userId,
        applicationId,
        JSON.stringify({ status: previous.status }),
        JSON.stringify({ status: "rfi_requested", message, dueDate, rfiId: rfiResult.rows[0]?.id }),
      ],
    )

    await client.query("COMMIT")

    return NextResponse.json({
      ok: true,
      application: { id: applicationId, status: "rfi_requested" },
      rfi: rfiResult.rows[0],
    })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    logServerError("Failed to issue reviewer application RFI", error, {
      module: "api/reviewer/applications/[applicationId]/rfi",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to issue request for information." },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}
