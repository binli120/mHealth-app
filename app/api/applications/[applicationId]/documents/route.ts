import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { insertDocument, listDocumentsByApplication } from "@/lib/db/documents"
import {
  uploadDocumentToStorage,
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

    // Attach a fresh signed URL to each document so the client can display/download files
    const docsWithUrls = await Promise.all(
      docs.map(async (doc) => {
        if (!doc.filePath) return { ...doc, signedUrl: null }
        try {
          const signedUrl = await getSignedDocumentUrl({
            accessToken,
            storagePath: doc.filePath,
          })
          return { ...doc, signedUrl }
        } catch {
          return { ...doc, signedUrl: null }
        }
      }),
    )

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

    // 2. Persist document record in PostgreSQL
    //    Note: we INSERT with a generated documentId so the record ID matches
    //    the storage path segment.  The DB uses gen_random_uuid() by default,
    //    so we pass our pre-generated ID via the INSERT explicitly.
    const pool = (await import("@/lib/db/server")).getDbPool()
    const { rows } = await pool.query(
      `
        INSERT INTO public.documents (
          id,
          application_id,
          uploaded_by,
          document_type,
          required_document_label,
          file_name,
          file_path,
          file_size_bytes,
          mime_type,
          document_status
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, 'uploaded')
        RETURNING *
      `,
      [
        documentId,
        applicationId,
        authResult.userId,
        documentType ?? null,
        requiredDocumentLabel ?? null,
        fileEntry.name,
        storagePath,
        fileEntry.size,
        fileEntry.type,
      ],
    )

    const document = rows[0] as Record<string, unknown>

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
          id: String(document.id),
          applicationId: String(document.application_id),
          uploadedBy: (document.uploaded_by as string | null) ?? null,
          documentType: (document.document_type as string | null) ?? null,
          requiredDocumentLabel: (document.required_document_label as string | null) ?? null,
          fileName: (document.file_name as string | null) ?? null,
          filePath: (document.file_path as string | null) ?? null,
          fileSizeBytes: document.file_size_bytes != null ? Number(document.file_size_bytes) : null,
          mimeType: (document.mime_type as string | null) ?? null,
          documentStatus: String(document.document_status ?? "uploaded"),
          uploadedAt: String(document.uploaded_at),
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
