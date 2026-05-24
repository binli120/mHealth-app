/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * PHI draft blob — encrypted applicant PHI stored in Supabase Storage.
 *
 * POST  /api/applications/{id}/phi-draft
 *   Upload a new encrypted blob. Deletes the previous blob if one existed.
 *   Body: { resumeId: string, encryptedBlob: string (base64) }
 *
 * GET   /api/applications/{id}/phi-draft?resumeId={uuid}
 *   Download the encrypted blob after verifying the resumeId matches the DB.
 *   Returns { ok: true, encryptedBlob: string (base64) }
 *
 * DELETE /api/applications/{id}/phi-draft
 *   Delete the blob and clear phi_draft_resume_id in the DB.
 *
 * The server never sees the AES key — only the encrypted blob. The key is
 * held exclusively by the applicant as part of their resume token.
 */

import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import {
  ApplicationDraftAccessError,
  swapPhiDraftResumeId,
  verifyPhiDraftResumeId,
  clearPhiDraftResumeId,
} from "@/lib/db/application-drafts"
import { encryptApplicantField, decryptOrPlain } from "@/lib/db/applicant-fields"
import {
  uploadToStorage,
  deleteFromStorage,
  downloadBlobFromStorage,
  buildPhiDraftStoragePath,
} from "@/lib/supabase/storage"

export const runtime = "nodejs"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BLOB_MAX_BYTES = 512_000 // 500 KB — generous upper bound for an encrypted wizard state

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
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

// ── POST: upload encrypted blob ───────────────────────────────────────────────

const postBodySchema = z.object({
  resumeId: z.string().uuid(),
  encryptedBlob: z.string().min(1).max(BLOB_MAX_BYTES),
  /** Raw AES-256 base64 key — stored encrypted on the server so the user can resume without a token. */
  aesKeyBase64: z.string().min(1).max(512).optional(),
})

export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { applicationId } = await context.params
    if (!isValidUuid(applicationId)) {
      return NextResponse.json({ ok: false, error: "Invalid applicationId." }, { status: 400 })
    }

    const rawBody = await request.text()
    if (rawBody.length > BLOB_MAX_BYTES + 256) {
      return NextResponse.json({ ok: false, error: "Request body too large." }, { status: 413 })
    }

    let body: z.infer<typeof postBodySchema>
    try {
      body = postBodySchema.parse(JSON.parse(rawBody))
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 })
    }

    const actingFor = request.headers.get("X-Acting-For-Patient") ?? undefined

    // Encrypt the AES key server-side before storage so the user can auto-resume.
    const keyEnc = body.aesKeyBase64 ? encryptApplicantField(body.aesKeyBase64) : null

    // Atomically swap resume IDs — returns the old one for cleanup.
    const { previousResumeId } = await swapPhiDraftResumeId({
      userId: authResult.userId,
      applicationId,
      newResumeId: body.resumeId,
      keyEnc,
      actingForUserId: actingFor,
    })

    // Delete old blob (non-fatal if it doesn't exist).
    if (previousResumeId && previousResumeId !== body.resumeId) {
      const oldPath = buildPhiDraftStoragePath(applicationId, previousResumeId)
      await deleteFromStorage({ storagePaths: [oldPath] }).catch((err) => {
        logServerError("Failed to delete old phi draft blob", err, {
          module: "api/applications/phi-draft",
          applicationId,
          previousResumeId,
        })
      })
    }

    // Upload new blob.
    const blobBuffer = Buffer.from(body.encryptedBlob, "utf-8")
    const newPath = buildPhiDraftStoragePath(applicationId, body.resumeId)
    await uploadToStorage({
      fileBuffer: blobBuffer,
      mimeType: "application/octet-stream",
      storagePath: newPath,
      upsert: true,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isApplicationDraftAccessError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Application draft is not accessible.",
        },
        { status: 403 },
      )
    }

    logServerError("Failed to upload phi draft", error, {
      module: "api/applications/phi-draft",
    })
    return NextResponse.json({ ok: false, error: "Failed to save draft." }, { status: 500 })
  }
}

// ── GET: download encrypted blob ─────────────────────────────────────────────

export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { applicationId } = await context.params
    if (!isValidUuid(applicationId)) {
      return NextResponse.json({ ok: false, error: "Invalid applicationId." }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const resumeId = searchParams.get("resumeId") ?? ""
    if (!isValidUuid(resumeId)) {
      return NextResponse.json({ ok: false, error: "resumeId is required." }, { status: 400 })
    }

    const actingFor = request.headers.get("X-Acting-For-Patient") ?? undefined

    // Gate: resumeId must match what is stored in the DB.
    const valid = await verifyPhiDraftResumeId({
      userId: authResult.userId,
      applicationId,
      resumeId,
      actingForUserId: actingFor,
    })

    if (!valid) {
      return NextResponse.json({ ok: false, error: "Resume token not found." }, { status: 404 })
    }

    const storagePath = buildPhiDraftStoragePath(applicationId, resumeId)
    const [blobBuffer, record] = await Promise.all([
      downloadBlobFromStorage({ storagePath }),
      import("@/lib/db/application-drafts").then((m) =>
        m.getApplicationDraft(authResult.userId, applicationId, actingFor),
      ),
    ])
    const encryptedBlob = blobBuffer.toString("utf-8")
    const aesKeyBase64 = record?.phiDraftKeyEnc
      ? decryptOrPlain(record.phiDraftKeyEnc)
      : null

    return NextResponse.json({ ok: true, encryptedBlob, aesKeyBase64 })
  } catch (error) {
    logServerError("Failed to download phi draft", error, {
      module: "api/applications/phi-draft",
    })
    return NextResponse.json({ ok: false, error: "Failed to load draft." }, { status: 500 })
  }
}

// ── DELETE: remove blob ───────────────────────────────────────────────────────

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { applicationId } = await context.params
    if (!isValidUuid(applicationId)) {
      return NextResponse.json({ ok: false, error: "Invalid applicationId." }, { status: 400 })
    }

    const actingFor = request.headers.get("X-Acting-For-Patient") ?? undefined

    const draft = await import("@/lib/db/application-drafts").then((m) =>
      m.getApplicationDraft(authResult.userId, applicationId, actingFor),
    )

    if (draft?.phiDraftResumeId) {
      const storagePath = buildPhiDraftStoragePath(applicationId, draft.phiDraftResumeId)
      await deleteFromStorage({ storagePaths: [storagePath] }).catch(() => {
        // Non-fatal — the DB cleanup below is the authoritative step.
      })
    }

    await clearPhiDraftResumeId({
      userId: authResult.userId,
      applicationId,
      actingForUserId: actingFor,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isApplicationDraftAccessError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Application draft is not accessible.",
        },
        { status: 403 },
      )
    }

    logServerError("Failed to delete phi draft", error, {
      module: "api/applications/phi-draft",
    })
    return NextResponse.json({ ok: false, error: "Failed to delete draft." }, { status: 500 })
  }
}
