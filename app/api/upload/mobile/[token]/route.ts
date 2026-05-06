/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * GET /api/upload/mobile/[token]
 *   Public — mobile device checks whether the token is still valid.
 *   Returns { ok, status }
 *
 * POST /api/upload/mobile/[token]
 *   Public — mobile device uploads the photo(s).
 *   Body: multipart/form-data.
 *
 *   Single-side documents:
 *     "file"       — the photo
 *
 *   Dual-side documents (government IDs / driver licences):
 *     "file_front" — photo of the front
 *     "file_back"  — photo of the back
 *
 *   The server validates, uploads to storage, inserts DB record(s), and marks
 *   the session as completed using service-role credentials (no user JWT needed).
 */

import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import {
  getUploadSessionByToken,
  completeUploadSession,
} from "@/lib/db/mobile-upload-session"
import {
  uploadDocumentToStorage,
  buildStoragePath,
} from "@/lib/supabase/storage"
import { insertDocument } from "@/lib/db/documents"
import { validateUpload } from "@/lib/uploads/validate"
import { logServerError } from "@/lib/server/logger"

interface RouteContext {
  params: Promise<{ token: string }>
}

// ─── GET — validate token ──────────────────────────────────────────────────

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params
  if (!token?.trim()) {
    return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 400 })
  }

  try {
    const session = await getUploadSessionByToken(token)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
    }
    return NextResponse.json({
      ok: true,
      status: session.status,
      documentLabel: session.requiredDocumentLabel ?? null,
    })
  } catch (err) {
    logServerError("Failed to check mobile upload session", err, { module: "upload/mobile" })
    return NextResponse.json({ ok: false, error: "Failed to check session." }, { status: 500 })
  }
}

// ─── POST — upload file(s) ─────────────────────────────────────────────────

export async function POST(request: Request, { params }: RouteContext) {
  const { token } = await params
  if (!token?.trim()) {
    return NextResponse.json({ ok: false, error: "Invalid session token." }, { status: 400 })
  }

  // 1. Validate session token
  let session
  try {
    session = await getUploadSessionByToken(token)
  } catch (err) {
    logServerError("Failed to look up mobile upload session", err, { module: "upload/mobile" })
    return NextResponse.json({ ok: false, error: "Session lookup failed." }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 })
  }
  if (session.status === "expired") {
    return NextResponse.json(
      { ok: false, error: "This upload link has expired. Please request a new QR code." },
      { status: 410 },
    )
  }
  if (session.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "This session has already been used." },
      { status: 409 },
    )
  }

  // 2. Parse multipart body
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be multipart/form-data." },
      { status: 400 },
    )
  }

  const isDualSide = formData.has("file_front") && formData.has("file_back")
  const isSingleFile = formData.has("file")

  if (!isDualSide && !isSingleFile) {
    return NextResponse.json(
      { ok: false, error: "A 'file' or 'file_front'/'file_back' field is required." },
      { status: 400 },
    )
  }

  // ── Dual-side upload (front + back) ───────────────────────────────────────

  if (isDualSide) {
    const frontEntry = formData.get("file_front")
    const backEntry = formData.get("file_back")

    if (!(frontEntry instanceof File) || !(backEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "file_front and file_back must be file fields." },
        { status: 400 },
      )
    }

    // Validate both files
    const frontVal = await validateUpload(frontEntry, "document")
    if (!frontVal.ok) {
      return NextResponse.json(
        { ok: false, error: `Front photo: ${frontVal.error}` },
        { status: frontVal.status },
      )
    }

    const backVal = await validateUpload(backEntry, "document")
    if (!backVal.ok) {
      return NextResponse.json(
        { ok: false, error: `Back photo: ${backVal.error}` },
        { status: backVal.status },
      )
    }

    const frontDocId = randomUUID()
    const backDocId = randomUUID()
    const baseLabel = session.requiredDocumentLabel ?? "Document"

    const frontPath = buildStoragePath(
      session.userId,
      session.applicationId,
      frontDocId,
      frontEntry.name,
    )
    const backPath = buildStoragePath(
      session.userId,
      session.applicationId,
      backDocId,
      backEntry.name,
    )

    try {
      // Upload both sides to Supabase Storage (service-role — no user JWT needed)
      await uploadDocumentToStorage({
        fileBuffer: Buffer.from(await frontEntry.arrayBuffer()),
        mimeType: frontVal.mimeType,
        storagePath: frontPath,
      })
      await uploadDocumentToStorage({
        fileBuffer: Buffer.from(await backEntry.arrayBuffer()),
        mimeType: backVal.mimeType,
        storagePath: backPath,
      })

      // Insert front document record
      const frontDoc = await insertDocument({
        id: frontDocId,
        applicationId: session.applicationId,
        uploadedBy: session.userId,
        documentType: session.documentType ?? undefined,
        requiredDocumentLabel: `${baseLabel} (Front)`,
        fileName: frontEntry.name,
        filePath: frontPath,
        fileSizeBytes: frontEntry.size,
        mimeType: frontVal.mimeType,
      })

      if (!frontDoc) {
        return NextResponse.json(
          { ok: false, error: "Failed to save front document record." },
          { status: 500 },
        )
      }

      // Insert back document record
      const backDoc = await insertDocument({
        id: backDocId,
        applicationId: session.applicationId,
        uploadedBy: session.userId,
        documentType: session.documentType ?? undefined,
        requiredDocumentLabel: `${baseLabel} (Back)`,
        fileName: backEntry.name,
        filePath: backPath,
        fileSizeBytes: backEntry.size,
        mimeType: backVal.mimeType,
      })

      if (!backDoc) {
        return NextResponse.json(
          { ok: false, error: "Failed to save back document record." },
          { status: 500 },
        )
      }

      // Mark session completed — front document is the primary reference
      await completeUploadSession(token, frontDocId)

      return NextResponse.json({ ok: true, documentId: frontDocId, backDocumentId: backDocId })
    } catch (err) {
      logServerError("Mobile dual-side document upload error", err, { module: "upload/mobile" })
      return NextResponse.json(
        {
          ok: false,
          error:
            process.env.NODE_ENV === "development" && err instanceof Error
              ? err.message
              : "Upload failed. Please try again.",
        },
        { status: 500 },
      )
    }
  }

  // ── Single-file upload ────────────────────────────────────────────────────

  const fileEntry = formData.get("file")
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ ok: false, error: "A file field is required." }, { status: 400 })
  }

  // Validate file
  const validation = await validateUpload(fileEntry, "document")
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: validation.status })
  }

  const documentId = randomUUID()
  const storagePath = buildStoragePath(
    session.userId,
    session.applicationId,
    documentId,
    fileEntry.name,
  )

  try {
    const arrayBuffer = await fileEntry.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    await uploadDocumentToStorage({
      fileBuffer,
      mimeType: validation.mimeType,
      storagePath,
    })

    const document = await insertDocument({
      id: documentId,
      applicationId: session.applicationId,
      uploadedBy: session.userId,
      documentType: session.documentType ?? undefined,
      requiredDocumentLabel: session.requiredDocumentLabel ?? undefined,
      fileName: fileEntry.name,
      filePath: storagePath,
      fileSizeBytes: fileEntry.size,
      mimeType: validation.mimeType,
    })

    if (!document) {
      return NextResponse.json(
        { ok: false, error: "Failed to save document record." },
        { status: 500 },
      )
    }

    await completeUploadSession(token, documentId)

    return NextResponse.json({ ok: true, documentId })
  } catch (err) {
    logServerError("Mobile document upload error", err, { module: "upload/mobile" })
    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development" && err instanceof Error
            ? err.message
            : "Upload failed. Please try again.",
      },
      { status: 500 },
    )
  }
}
