/**
 * POST /api/masshealth/income-verification/documents
 *
 * Upload a single income-proof document tied to a specific household member
 * and income source.  Returns a job_id for async extraction tracking.
 *
 * Body: multipart/form-data
 *   file            — binary file (JPEG, PNG, WebP, HEIC, PDF) required
 *   applicationId   — UUID required
 *   memberId        — UUID required
 *   docTypeClaimed  — IncomeDocType string required
 *
 * Response: IncomeDocumentUploadResponse
 */

import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import {
  insertIncomeDocument,
  userCanAccessApplication,
} from "@/lib/db/income-verification"
import { uploadDocumentToStorage, buildStoragePath } from "@/lib/supabase/storage"
import type { IncomeDocumentUploadResponse } from "@/lib/masshealth/types"
import { validateUpload } from "@/lib/uploads/validate"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function extractBearerToken(request: Request): string | undefined {
  const value = request.headers.get("authorization") ?? ""
  const [scheme, token] = value.trim().split(/\s+/, 2)
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { ok: false, error: "Request body must be multipart/form-data." },
        { status: 400 },
      )
    }

    const applicationId   = (formData.get("applicationId") as string | null) ?? ""
    const memberId        = (formData.get("memberId") as string | null) ?? ""
    const docTypeClaimed  = (formData.get("docTypeClaimed") as string | null) ?? ""
    const fileEntry       = formData.get("file")

    if (!UUID_PATTERN.test(applicationId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId must be a valid UUID." },
        { status: 400 },
      )
    }
    if (!UUID_PATTERN.test(memberId)) {
      return NextResponse.json(
        { ok: false, error: "memberId must be a valid UUID." },
        { status: 400 },
      )
    }
    if (!docTypeClaimed) {
      return NextResponse.json(
        { ok: false, error: "docTypeClaimed is required." },
        { status: 400 },
      )
    }
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "A file field is required." },
        { status: 400 },
      )
    }

    const validation = await validateUpload(fileEntry, "document")
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: validation.status })
    }

    const canAccess = await userCanAccessApplication(authResult.userId, applicationId)
    if (!canAccess) {
      return NextResponse.json(
        { ok: false, error: "Application not found or not accessible." },
        { status: 403 },
      )
    }

    const documentId   = randomUUID()
    const storagePath  = buildStoragePath(
      authResult.userId,
      applicationId,
      documentId,
      fileEntry.name,
    )

    const fileBuffer  = Buffer.from(await fileEntry.arrayBuffer())
    const accessToken = extractBearerToken(request)

    await uploadDocumentToStorage({ accessToken, fileBuffer, mimeType: validation.mimeType, storagePath })

    const { jobId } = await insertIncomeDocument({
      applicationId,
      memberId,
      docTypeClaimed: docTypeClaimed as import("@/lib/masshealth/types").IncomeDocType,
      storageKey:     storagePath,
      mimeType:       validation.mimeType,
      fileName:       fileEntry.name,
      fileSizeBytes:  fileEntry.size,
      uploadedBy:     authResult.userId,
    })

    const response: IncomeDocumentUploadResponse = {
      jobId,
      documentId,
      status: "queued",
    }

    return NextResponse.json({ ok: true, ...response }, { status: 201 })
  } catch (error) {
    logServerError("Failed to upload income document", error, {
      module: "api/masshealth/income-verification/documents",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to upload income document." },
      { status: 500 },
    )
  }
}
