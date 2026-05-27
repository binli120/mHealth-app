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
import { insertDocument, updateDocumentValidation } from "@/lib/db/documents"
import { validateUpload } from "@/lib/uploads/validate"
import { createAndUploadDocumentArtifacts } from "@/lib/uploads/document-artifacts"
import { validateUploadedDocument } from "@/lib/masshealth/document-validation-workflow"
import { logServerError } from "@/lib/server/logger"
import { checkRateLimitAsync, mobileUploadLimiter } from "@/lib/server/rate-limit"
import {
  isDriverLicenseDocument,
  requiresDualSideDocument,
} from "@/lib/uploads/document-requirements"
import {
  analyzeMassachusettsDriverLicenseImages,
  isValidMassachusettsDriverLicense,
} from "@/lib/masshealth/driver-license-analysis-client"

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
    // Enforce expiry by timestamp — do not rely solely on the status column,
    // which may not have been updated yet by the cleanup job.
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Session expired." },
        { status: 410 },
      )
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

  // Enforce expiry by timestamp — do not rely solely on the status column,
  // which may not have been updated yet by the cleanup job.
  if (new Date(session.expiresAt) < new Date()) {
    return NextResponse.json(
      { ok: false, error: "This upload link has expired. Please request a new QR code." },
      { status: 410 },
    )
  }

  const rlResponse = await checkRateLimitAsync(mobileUploadLimiter, `mobile-upload:${token}`)
  if (rlResponse) return rlResponse

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

  const requiresDualSide = requiresDualSideDocument(
    session.documentType,
    session.requiredDocumentLabel,
  )
  const requiresDriverLicenseAnalysis = isDriverLicenseDocument(
    session.documentType,
    session.requiredDocumentLabel,
  )
  const isDualSide = formData.has("file_front") && formData.has("file_back")
  const isSingleFile = formData.has("file")

  if (requiresDualSide && !isDualSide) {
    return NextResponse.json(
      {
        ok: false,
        error: "Front and back photos are required for a driver's license or government ID.",
      },
      { status: 400 },
    )
  }

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

    if (requiresDriverLicenseAnalysis) {
      if (!frontVal.mimeType.startsWith("image/") || !backVal.mimeType.startsWith("image/")) {
        return NextResponse.json(
          {
            ok: false,
            error: "Driver's license validation requires front and back image photos.",
          },
          { status: 400 },
        )
      }

      let analysis
      try {
        analysis = await analyzeMassachusettsDriverLicenseImages({
          userId: session.userId,
          frontFile: frontEntry,
          backFile: backEntry,
        })
      } catch (err) {
        logServerError("Driver license analysis request failed", err, { module: "upload/mobile" })
        return NextResponse.json(
          {
            ok: false,
            error:
              "We could not validate this driver's license right now. Please try again, or use the desktop upload if the problem continues.",
          },
          { status: 502 },
        )
      }

      if (!isValidMassachusettsDriverLicense(analysis)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              analysis.reason ||
              "This does not appear to be a valid Massachusetts driver's license. Please retake clear front and back photos.",
          },
          { status: 422 },
        )
      }
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
      const frontBuffer = Buffer.from(await frontEntry.arrayBuffer())
      const backBuffer = Buffer.from(await backEntry.arrayBuffer())
      let frontArtifacts: { thumbnailPath: string | null; pdfPath: string | null } = {
        thumbnailPath: null,
        pdfPath: null,
      }
      let backArtifacts: { thumbnailPath: string | null; pdfPath: string | null } = {
        thumbnailPath: null,
        pdfPath: null,
      }

      // Upload both sides to Supabase Storage (service-role — no user JWT needed)
      await uploadDocumentToStorage({
        fileBuffer: frontBuffer,
        mimeType: frontVal.mimeType,
        storagePath: frontPath,
      })
      try {
        frontArtifacts = await createAndUploadDocumentArtifacts({
          fileBuffer: frontBuffer,
          mimeType: frontVal.mimeType,
          storagePath: frontPath,
        })
      } catch (artifactError) {
        logServerError("Failed to create mobile front document artifacts", artifactError, {
          module: "upload/mobile",
          storagePath: frontPath,
        })
      }
      await uploadDocumentToStorage({
        fileBuffer: backBuffer,
        mimeType: backVal.mimeType,
        storagePath: backPath,
      })
      try {
        backArtifacts = await createAndUploadDocumentArtifacts({
          fileBuffer: backBuffer,
          mimeType: backVal.mimeType,
          storagePath: backPath,
        })
      } catch (artifactError) {
        logServerError("Failed to create mobile back document artifacts", artifactError, {
          module: "upload/mobile",
          storagePath: backPath,
        })
      }

      // Insert front document record
      const frontDoc = await insertDocument({
        id: frontDocId,
        applicationId: session.applicationId,
        uploadedBy: session.userId,
        documentType: session.documentType ?? undefined,
        requiredDocumentLabel: `${baseLabel} (Front)`,
        fileName: frontEntry.name,
        filePath: frontPath,
        thumbnailPath: frontArtifacts.thumbnailPath,
        pdfPath: frontArtifacts.pdfPath,
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
        thumbnailPath: backArtifacts.thumbnailPath,
        pdfPath: backArtifacts.pdfPath,
        fileSizeBytes: backEntry.size,
        mimeType: backVal.mimeType,
      })

      if (!backDoc) {
        return NextResponse.json(
          { ok: false, error: "Failed to save back document record." },
          { status: 500 },
        )
      }

      const validatedFrontDoc = await validateUploadedDocument({
        userId: session.userId,
        document: frontDoc,
        file: frontEntry,
        backFile: backEntry,
        mimeType: frontVal.mimeType,
      }).catch((analysisError) => {
        logServerError("Mobile front document analysis workflow failed", analysisError, {
          module: "upload/mobile",
          documentId: frontDocId,
        })
        return frontDoc
      })

      await updateDocumentValidation({
        documentId: backDoc.id,
        documentStatus: validatedFrontDoc.documentStatus,
        validationStatus: validatedFrontDoc.validationStatus,
        analysisDocumentType: validatedFrontDoc.analysisDocumentType,
        validationError: validatedFrontDoc.validationError,
        validationSummary: validatedFrontDoc.validationSummary
          ? { ...validatedFrontDoc.validationSummary, pairedWithFrontDocumentId: frontDoc.id }
          : { pairedWithFrontDocumentId: frontDoc.id },
        validationCertificate: validatedFrontDoc.validationCertificate,
      }).catch(() => undefined)

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
    let artifacts: { thumbnailPath: string | null; pdfPath: string | null } = {
      thumbnailPath: null,
      pdfPath: null,
    }

    await uploadDocumentToStorage({
      fileBuffer,
      mimeType: validation.mimeType,
      storagePath,
    })
    try {
      artifacts = await createAndUploadDocumentArtifacts({
        fileBuffer,
        mimeType: validation.mimeType,
        storagePath,
      })
    } catch (artifactError) {
      logServerError("Failed to create mobile document artifacts", artifactError, {
        module: "upload/mobile",
        storagePath,
      })
    }

    let document = await insertDocument({
      id: documentId,
      applicationId: session.applicationId,
      uploadedBy: session.userId,
      documentType: session.documentType ?? undefined,
      requiredDocumentLabel: session.requiredDocumentLabel ?? undefined,
      fileName: fileEntry.name,
      filePath: storagePath,
      thumbnailPath: artifacts.thumbnailPath,
      pdfPath: artifacts.pdfPath,
      fileSizeBytes: fileEntry.size,
      mimeType: validation.mimeType,
    })

    if (!document) {
      return NextResponse.json(
        { ok: false, error: "Failed to save document record." },
        { status: 500 },
      )
    }

    document = await validateUploadedDocument({
      userId: session.userId,
      document,
      file: fileEntry,
      mimeType: validation.mimeType,
    }).catch((analysisError) => {
      logServerError("Mobile document analysis workflow failed", analysisError, {
        module: "upload/mobile",
        documentId,
      })
      return document!
    })

    await completeUploadSession(token, documentId)

    return NextResponse.json({
      ok: true,
      documentId,
      validationStatus: document.validationStatus,
      validationError: document.validationError,
    })
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
