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

const DECISIONS = new Set(["approved", "denied"])

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized) return null
  return normalized.slice(0, maxLength)
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

  let body: { decision?: string; notes?: unknown; program?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    )
  }

  const decision = body.decision
  if (!decision || !DECISIONS.has(decision)) {
    return NextResponse.json(
      { ok: false, error: "decision must be approved or denied." },
      { status: 400 },
    )
  }

  const notes = normalizeText(body.notes, 4000)
  const program = normalizeText(body.program, 250)
  const reason = normalizeText(body.reason, 500)
  const actionType = decision === "approved" ? "approve" : "deny"
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

    const updatedResult = await client.query<{ id: string; status: string; decided_at: string }>(
      `
        UPDATE public.applications
        SET status = $2::application_status,
            decided_at = NOW()
        WHERE id = $1::uuid
        RETURNING id::text, status::text, decided_at
      `,
      [applicationId, decision],
    )

    const reviewNotes = [
      notes,
      program ? `Program: ${program}` : null,
      reason ? `Reason: ${reason}` : null,
    ].filter(Boolean).join("\n")

    await client.query(
      `
        INSERT INTO public.review_actions (application_id, reviewer_id, action_type, notes)
        VALUES ($1::uuid, $2::uuid, $3, $4)
      `,
      [applicationId, authResult.userId, actionType, reviewNotes || null],
    )

    await client.query(
      `
        INSERT INTO public.audit_logs (user_id, application_id, action, old_data, new_data)
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4::jsonb,
          $5::jsonb
        )
      `,
      [
        authResult.userId,
        applicationId,
        `application.${decision}`,
        JSON.stringify({ status: previous.status }),
        JSON.stringify({ status: decision, notes, program, reason }),
      ],
    )

    await client.query("COMMIT")

    return NextResponse.json({ ok: true, application: updatedResult.rows[0] })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    logServerError("Failed to record reviewer application decision", error, {
      module: "api/reviewer/applications/[applicationId]/decision",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to record application decision." },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}
