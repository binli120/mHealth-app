/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  insertDocument,
  listDocumentsByApplication,
  userCanAccessApplication,
} from "@/lib/db/documents"
import {
  deleteFromStorage,
  uploadDocumentToStorage,
  getSignedDocumentUrls,
  getSignedDocumentUrl,
  buildStoragePath,
} from "@/lib/supabase/storage"
import { logServerError } from "@/lib/server/logger"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
])

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

interface RouteContext {
  params: Promise<{ applicationId: string }>
}

// ---------------------------------------------------------------------------
// Helper: extract raw Bearer token from Authorization header
// (used to pass user JWT to Storage when service-role key is absent)
// ---------------------------------------------------------------------------
function extractBearerToken(request: Request): string | undefined {
  const value = request.headers.get("authorization") ?? ""
  const [scheme, token] = value.trim().split(/\s+/, 2)
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined
}

// ---------------------------------------------------------------------------
// GET  /api/applications/[applicationId]/documents
// Returns the list of documents for an application, each with a signed URL.
// ---------------------------------------------------------------------------
export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { applicationId } = await context.params
    if (!UUID_PATTERN.test(applicationId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId must be a valid UUID." },
        { status: 400 },
      )
    }

    const accessToken = extractBearerToken(request)
    const docs = await listDocumentsByApplication(authResult.userId, applicationId)
    const uniquePaths = docs
      .map((doc) => doc.filePath)
      .filter((path): path is string => Boolean(path))
    const signedUrlMap = await getSignedDocumentUrls({
      accessToken,
      storagePaths: uniquePaths,
    })
    const docsWithUrls = docs.map((doc) => ({
      ...doc,
      signedUrl: doc.filePath ? signedUrlMap[doc.filePath] ?? null : null,
    }))

    return NextResponse.json({ ok: true, documents: docsWithUrls })
  } catch (error) {
    logServerError("Failed to list application documents", error, {
      module: "api/applications/[applicationId]/documents",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve documents." },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST  /api/applications/[applicationId]/documents
// Uploads a file to Supabase Storage and records the document in the DB.
//
// Body: multipart/form-data
//   file                   — the binary file (required)
//   documentType           — e.g. "paystub", "id", "utility_bill" (optional)
//   requiredDocumentLabel  — human-readable label, e.g. "MA Driver's License" (optional)
//
// Response: { ok: true; document: DocumentRecord; signedUrl: string }
// ---------------------------------------------------------------------------
export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { applicationId } = await context.params
    if (!UUID_PATTERN.test(applicationId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId must be a valid UUID." },
        { status: 400 },
      )
    }

    if (!(await userCanAccessApplication(authResult.userId, applicationId))) {
      return NextResponse.json(
        { ok: false, error: "Application not found or not accessible." },
        { status: 403 },
      )
    }

    // Parse multipart body
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { ok: false, error: "Request body must be multipart/form-data." },
        { status: 400 },
      )
    }

    const fileEntry = formData.get("file")
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "A file field is required." },
        { status: 400 },
      )
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(fileEntry.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported file type "${fileEntry.type}". Allowed: JPEG, PNG, WebP, HEIC, PDF.`,
        },
        { status: 422 },
      )
    }

    // Validate file size
    if (fileEntry.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { ok: false, error: `File exceeds the 10 MB limit (${fileEntry.size} bytes).` },
        { status: 422 },
      )
    }

    const documentType = (formData.get("documentType") as string | null) ?? undefined
    const requiredDocumentLabel =
      (formData.get("requiredDocumentLabel") as string | null) ?? undefined

    // Generate a stable document ID up-front so we can use it in the storage path
    const documentId = randomUUID()
    const storagePath = buildStoragePath(
      authResult.userId,
      applicationId,
      documentId,
      fileEntry.name,
    )

    // Convert File → Buffer for server-side upload
    const arrayBuffer = await fileEntry.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    const accessToken = extractBearerToken(request)

    // 1. Upload binary to Supabase Storage
    await uploadDocumentToStorage({
      accessToken,
      fileBuffer,
      mimeType: fileEntry.type,
      storagePath,
    })

    // 2. Persist document record in PostgreSQL with an ownership check.
    const document = await insertDocument({
      id: documentId,
      applicationId,
      uploadedBy: authResult.userId,
      documentType,
      requiredDocumentLabel,
      fileName: fileEntry.name,
      filePath: storagePath,
      fileSizeBytes: fileEntry.size,
      mimeType: fileEntry.type,
    })

    if (!document) {
      try {
        await deleteFromStorage({ accessToken, storagePaths: [storagePath] })
      } catch {
        // Best-effort cleanup for an upload that failed authorization at insert time.
      }
      return NextResponse.json(
        { ok: false, error: "Application not found or not accessible." },
        { status: 403 },
      )
    }

    // 3. Generate a signed URL for the freshly uploaded file
    let signedUrl: string | null = null
    try {
      signedUrl = await getSignedDocumentUrl({ accessToken, storagePath })
    } catch {
      // Non-fatal — client can request a signed URL separately
    }

    return NextResponse.json(
      {
        ok: true,
        document: {
          id: document.id,
          applicationId: document.applicationId,
          uploadedBy: document.uploadedBy,
          documentType: document.documentType,
          requiredDocumentLabel: document.requiredDocumentLabel,
          fileName: document.fileName,
          filePath: document.filePath,
          fileSizeBytes: document.fileSizeBytes,
          mimeType: document.mimeType,
          documentStatus: document.documentStatus,
          uploadedAt: document.uploadedAt,
          signedUrl,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    logServerError("Failed to upload document", error, {
      module: "api/applications/[applicationId]/documents",
    })
    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "Failed to upload document. Please try again.",
      },
      { status: 500 },
    )
  }
}
