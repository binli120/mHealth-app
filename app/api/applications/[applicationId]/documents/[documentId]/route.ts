/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getDocumentById, deleteDocumentById } from "@/lib/db/documents"
import { deleteDocumentFromStorage, getSignedDocumentUrl } from "@/lib/supabase/storage"
import { logServerError } from "@/lib/server/logger"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ applicationId: string; documentId: string }>
}

function extractBearerToken(request: Request): string | undefined {
  const value = request.headers.get("authorization") ?? ""
  const [scheme, token] = value.trim().split(/\s+/, 2)
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined
}

// ---------------------------------------------------------------------------
// GET  /api/applications/[applicationId]/documents/[documentId]
// Returns a single document record with a fresh signed URL.
// ---------------------------------------------------------------------------
export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { applicationId, documentId } = await context.params

    if (!UUID_PATTERN.test(applicationId) || !UUID_PATTERN.test(documentId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId and documentId must be valid UUIDs." },
        { status: 400 },
      )
    }

    const doc = await getDocumentById(authResult.userId, documentId)
    if (!doc || doc.applicationId !== applicationId) {
      return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 })
    }

    const accessToken = extractBearerToken(request)
    let signedUrl: string | null = null
    if (doc.filePath) {
      try {
        signedUrl = await getSignedDocumentUrl({ accessToken, storagePath: doc.filePath })
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({ ok: true, document: { ...doc, signedUrl } })
  } catch (error) {
    logServerError("Failed to fetch document", error, {
      module: "api/applications/[applicationId]/documents/[documentId]",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to retrieve document." },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE  /api/applications/[applicationId]/documents/[documentId]
// Removes the document record from the DB and the file from Supabase Storage.
// Storage deletion failure is logged but does NOT abort — the DB record is
// already gone and the file will be orphaned rather than leaving a broken record.
// ---------------------------------------------------------------------------
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const { applicationId, documentId } = await context.params

    if (!UUID_PATTERN.test(applicationId) || !UUID_PATTERN.test(documentId)) {
      return NextResponse.json(
        { ok: false, error: "applicationId and documentId must be valid UUIDs." },
        { status: 400 },
      )
    }

    // Remove DB record first; if this fails the file is still intact
    const deleted = await deleteDocumentById(authResult.userId, documentId)
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "Document not found or not accessible." },
        { status: 404 },
      )
    }

    // Remove the file from Supabase Storage (best-effort)
    if (deleted.filePath) {
      const accessToken = extractBearerToken(request)
      try {
        await deleteDocumentFromStorage({ accessToken, storagePath: deleted.filePath })
      } catch (storageError) {
        // Log the orphaned file but return success — the DB record is authoritative
        logServerError("Storage delete failed after DB delete; file may be orphaned", storageError, {
          module: "api/applications/[applicationId]/documents/[documentId]",
          filePath: deleted.filePath,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError("Failed to delete document", error, {
      module: "api/applications/[applicationId]/documents/[documentId]",
    })
    return NextResponse.json(
      { ok: false, error: "Failed to delete document. Please try again." },
      { status: 500 },
    )
  }
}
