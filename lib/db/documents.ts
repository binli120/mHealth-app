import "server-only"

import { getDbPool } from "@/lib/db/server"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentRecord {
  id: string
  applicationId: string
  uploadedBy: string | null
  documentType: string | null
  requiredDocumentLabel: string | null
  fileName: string | null
  filePath: string | null
  fileUrl: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  documentStatus: string
  uploadedAt: string
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function toRecord(row: Record<string, unknown>): DocumentRecord {
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    uploadedBy: (row.uploaded_by as string | null) ?? null,
    documentType: (row.document_type as string | null) ?? null,
    requiredDocumentLabel: (row.required_document_label as string | null) ?? null,
    fileName: (row.file_name as string | null) ?? null,
    filePath: (row.file_path as string | null) ?? null,
    fileUrl: (row.file_url as string | null) ?? null,
    fileSizeBytes:
      row.file_size_bytes != null ? Number(row.file_size_bytes) : null,
    mimeType: (row.mime_type as string | null) ?? null,
    documentStatus: String(row.document_status ?? "uploaded"),
    uploadedAt: String(row.uploaded_at),
  }
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Insert a new document record after the file has been stored.
 * `filePath` is the Supabase Storage object path.
 */
export async function insertDocument(params: {
  applicationId: string
  uploadedBy: string
  documentType?: string
  requiredDocumentLabel?: string
  fileName: string
  filePath: string
  fileSizeBytes: number
  mimeType: string
}): Promise<DocumentRecord> {
  const pool = getDbPool()

  const { rows } = await pool.query(
    `
      INSERT INTO public.documents (
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
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, 'uploaded')
      RETURNING *
    `,
    [
      params.applicationId,
      params.uploadedBy,
      params.documentType ?? null,
      params.requiredDocumentLabel ?? null,
      params.fileName,
      params.filePath,
      params.fileSizeBytes,
      params.mimeType,
    ],
  )

  return toRecord(rows[0] as Record<string, unknown>)
}

/**
 * List all documents belonging to an application.
 * Verifies user owns the application (or is staff) via a JOIN.
 */
export async function listDocumentsByApplication(
  userId: string,
  applicationId: string,
): Promise<DocumentRecord[]> {
  const pool = getDbPool()

  const { rows } = await pool.query(
    `
      SELECT d.*
      FROM public.documents d
      WHERE d.application_id = $1::uuid
        AND EXISTS (
          SELECT 1
          FROM public.applications a
          JOIN public.applicants ap ON ap.id = a.applicant_id
          WHERE a.id = $1::uuid
            AND ap.user_id = $2::uuid
        )
      ORDER BY d.uploaded_at DESC
    `,
    [applicationId, userId],
  )

  return rows.map((row) => toRecord(row as Record<string, unknown>))
}

/**
 * Fetch a single document, verifying that the requesting user owns it
 * (or is staff). Returns null if not found or not accessible.
 */
export async function getDocumentById(
  userId: string,
  documentId: string,
): Promise<DocumentRecord | null> {
  const pool = getDbPool()

  const { rows } = await pool.query(
    `
      SELECT d.*
      FROM public.documents d
      WHERE d.id = $1::uuid
        AND EXISTS (
          SELECT 1
          FROM public.applications a
          JOIN public.applicants ap ON ap.id = a.applicant_id
          WHERE a.id = d.application_id
            AND ap.user_id = $2::uuid
        )
      LIMIT 1
    `,
    [documentId, userId],
  )

  return rows.length > 0 ? toRecord(rows[0] as Record<string, unknown>) : null
}

/**
 * Delete a document record.
 * Returns the deleted row's `file_path` so the caller can also remove the
 * file from Supabase Storage.  Returns null if the row was not found or the
 * user does not have access.
 */
export async function deleteDocumentById(
  userId: string,
  documentId: string,
): Promise<{ filePath: string | null } | null> {
  const pool = getDbPool()

  const { rows } = await pool.query(
    `
      DELETE FROM public.documents
      WHERE id = $1::uuid
        AND application_id IN (
          SELECT a.id
          FROM public.applications a
          JOIN public.applicants ap ON ap.id = a.applicant_id
          WHERE ap.user_id = $2::uuid
        )
      RETURNING file_path
    `,
    [documentId, userId],
  )

  if (rows.length === 0) {
    return null
  }

  return {
    filePath: ((rows[0] as Record<string, unknown>).file_path as string | null) ?? null,
  }
}
