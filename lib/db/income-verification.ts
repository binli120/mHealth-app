/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * Database query layer for the income verification subsystem.
 * All SQL is parameterised — no string interpolation of user data.
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import type {
  IncomeSourceType,
  IncomeDocType,
  IncomeVerificationStatus,
  IncomeVerificationCaseStatus,
  IncomeEvidenceRequirement,
  IncomeDocumentExtraction,
  IncomeVerificationDecision,
  IncomeVerificationCase,
  IncomeRfiEvent,
} from "@/lib/masshealth/types"
import {
  computeVerificationCase,
  buildEvidenceRequirements,
} from "@/lib/masshealth/income-verification-engine"

// ── Row mappers ───────────────────────────────────────────────────────────────

function toRequirement(row: Record<string, unknown>): IncomeEvidenceRequirement {
  return {
    id:                 String(row.id),
    memberId:           String(row.member_id),
    memberName:         String(row.member_name),
    incomeSourceType:   String(row.income_source_type) as IncomeSourceType,
    acceptedDocTypes:   ((row.accepted_doc_types as string[]) ?? []) as IncomeDocType[],
    isRequired:         Boolean(row.is_required),
    verificationStatus: String(row.verification_status) as IncomeVerificationStatus,
  }
}

function toDecision(row: Record<string, unknown>): IncomeVerificationDecision {
  return {
    id:               String(row.id),
    memberId:         String(row.member_id),
    sourceType:       String(row.source_type) as IncomeSourceType,
    status:           String(row.status) as IncomeVerificationStatus,
    matchedAmount:    row.matched_amount != null ? Number(row.matched_amount) : null,
    matchedFrequency: (row.matched_frequency as string | null) ?? null,
    reviewerId:       (row.reviewer_id as string | null) ?? null,
    reasonCode:       String(row.reason_code ?? "auto"),
    decidedAt:        String(row.decided_at),
  }
}

function toExtraction(row: Record<string, unknown>): IncomeDocumentExtraction {
  return {
    documentId:        String(row.document_id),
    docType:           (row.doc_type as IncomeDocType | null) ?? null,
    issuer:            (row.issuer as string | null) ?? null,
    personName:        (row.person_name as string | null) ?? null,
    employerName:      (row.employer_name as string | null) ?? null,
    dateRangeStart:    (row.date_range_start as string | null) ?? null,
    dateRangeEnd:      (row.date_range_end as string | null) ?? null,
    grossAmount:       row.gross_amount != null ? Number(row.gross_amount) : null,
    netAmount:         row.net_amount != null ? Number(row.net_amount) : null,
    frequency:         (row.frequency as IncomeDocumentExtraction["frequency"]) ?? null,
    incomeSourceType:  (row.income_source_type as IncomeSourceType | null) ?? null,
    confidence:        Number(row.confidence ?? 0),
    needsManualReview: Boolean(row.needs_manual_review),
    reasons:           (row.reasons as string[]) ?? [],
    modelVersion:      String(row.model_version ?? "unknown"),
  }
}

// ── Access guard ──────────────────────────────────────────────────────────────

export async function userCanAccessApplication(
  userId:        string,
  applicationId: string,
): Promise<boolean> {
  const pool = getDbPool()
  const { rows } = await pool.query<{ has_access: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.applications a
       JOIN public.applicants ap ON ap.id = a.applicant_id
       WHERE a.id = $1::uuid AND ap.user_id = $2::uuid
     ) AS has_access`,
    [applicationId, userId],
  )
  return rows[0]?.has_access ?? false
}

// ── Case ──────────────────────────────────────────────────────────────────────

/**
 * Fetch or initialise the verification case for an application.
 * Joins requirements and decisions to build the full aggregate.
 */
export async function getIncomeVerificationCase(
  applicationId: string,
): Promise<IncomeVerificationCase | null> {
  const pool = getDbPool()

  const { rows: caseRows } = await pool.query(
    `SELECT * FROM public.income_verification_cases WHERE application_id = $1::uuid LIMIT 1`,
    [applicationId],
  )
  if (caseRows.length === 0) return null

  const { rows: reqRows } = await pool.query(
    `SELECT * FROM public.income_evidence_requirements
     WHERE application_id = $1::uuid
     ORDER BY member_name, income_source_type`,
    [applicationId],
  )

  const { rows: decRows } = await pool.query(
    `SELECT * FROM public.income_verification_decisions
     WHERE application_id = $1::uuid`,
    [applicationId],
  )

  const requirements = reqRows.map((r) => toRequirement(r as Record<string, unknown>))
  const decisions    = decRows.map((r) => toDecision(r as Record<string, unknown>))
  const caseRow      = caseRows[0] as Record<string, unknown>

  return {
    applicationId,
    status:               String(caseRow.status) as IncomeVerificationCaseStatus,
    requiredSourceCount:  Number(caseRow.required_source_count),
    verifiedSourceCount:  Number(caseRow.verified_source_count),
    decisionReason:       (caseRow.decision_reason as string | null) ?? null,
    requirements,
    decisions,
    incomeVerified:       Boolean(caseRow.income_verified),
  }
}

// ── Checklist upsert ──────────────────────────────────────────────────────────

export interface UpsertChecklistParams {
  applicationId:    string
  householdMembers: Array<{
    memberId:     string
    memberName:   string
    incomeSources: IncomeSourceType[]
    hasIncome:    boolean
  }>
}

/**
 * Idempotent: create or refresh requirements from intake data, then initialise
 * (or update) the case row.  Safe to call multiple times.
 */
export async function upsertIncomeChecklist(
  params: UpsertChecklistParams,
): Promise<IncomeEvidenceRequirement[]> {
  const { applicationId, householdMembers } = params
  const pool = getDbPool()
  const requirements = buildEvidenceRequirements(householdMembers)

  await pool.query("BEGIN")
  try {
    // Upsert each requirement
    for (const req of requirements) {
      await pool.query(
        `INSERT INTO public.income_evidence_requirements
           (id, application_id, member_id, member_name, income_source_type,
            accepted_doc_types, is_required, verification_status)
         VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
         ON CONFLICT (application_id, member_id, income_source_type)
         DO UPDATE SET
           member_name        = EXCLUDED.member_name,
           accepted_doc_types = EXCLUDED.accepted_doc_types,
           is_required        = EXCLUDED.is_required`,
        [
          req.id,
          applicationId,
          req.memberId,
          req.memberName,
          req.incomeSourceType,
          req.acceptedDocTypes,
          req.isRequired,
          req.verificationStatus,
        ],
      )
    }

    // Upsert the case row
    const requiredCount = requirements.filter((r) => r.isRequired).length
    await pool.query(
      `INSERT INTO public.income_verification_cases
         (application_id, status, required_source_count, verified_source_count,
          income_verified)
       VALUES ($1::uuid, 'pending_documents', $2, 0, FALSE)
       ON CONFLICT (application_id) DO UPDATE SET
         required_source_count = EXCLUDED.required_source_count`,
      [applicationId, requiredCount],
    )

    await pool.query("COMMIT")
  } catch (err) {
    await pool.query("ROLLBACK")
    throw err
  }

  return requirements
}

// ── Document insert ───────────────────────────────────────────────────────────

export interface InsertIncomeDocumentParams {
  applicationId:  string
  memberId:       string
  docTypeClaimed: IncomeDocType
  storageKey:     string
  mimeType:       string
  fileName:       string
  fileSizeBytes:  number
  uploadedBy:     string
}

export async function insertIncomeDocument(
  params: InsertIncomeDocumentParams,
): Promise<{ id: string; jobId: string }> {
  const pool = getDbPool()
  const { rows } = await pool.query(
    `INSERT INTO public.income_documents
       (application_id, member_id, doc_type_claimed, storage_key, mime_type,
        file_name, file_size_bytes, uploaded_by)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::uuid)
     RETURNING id, job_id`,
    [
      params.applicationId,
      params.memberId,
      params.docTypeClaimed,
      params.storageKey,
      params.mimeType,
      params.fileName,
      params.fileSizeBytes,
      params.uploadedBy,
    ],
  )
  const row = rows[0] as Record<string, unknown>
  return { id: String(row.id), jobId: String(row.job_id) }
}

// ── Extraction upsert ─────────────────────────────────────────────────────────

export async function upsertDocumentExtraction(
  extraction: Omit<IncomeDocumentExtraction, "documentId"> & { documentId: string },
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO public.income_document_extractions
       (document_id, doc_type, issuer, person_name, employer_name,
        date_range_start, date_range_end, gross_amount, net_amount,
        frequency, income_source_type, confidence, needs_manual_review,
        reasons, model_version)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11,
             $12, $13, $14, $15)
     ON CONFLICT (document_id) DO UPDATE SET
       doc_type           = EXCLUDED.doc_type,
       issuer             = EXCLUDED.issuer,
       person_name        = EXCLUDED.person_name,
       employer_name      = EXCLUDED.employer_name,
       date_range_start   = EXCLUDED.date_range_start,
       date_range_end     = EXCLUDED.date_range_end,
       gross_amount       = EXCLUDED.gross_amount,
       net_amount         = EXCLUDED.net_amount,
       frequency          = EXCLUDED.frequency,
       income_source_type = EXCLUDED.income_source_type,
       confidence         = EXCLUDED.confidence,
       needs_manual_review = EXCLUDED.needs_manual_review,
       reasons            = EXCLUDED.reasons,
       model_version      = EXCLUDED.model_version,
       extracted_at       = NOW()`,
    [
      extraction.documentId,
      extraction.docType,
      extraction.issuer,
      extraction.personName,
      extraction.employerName,
      extraction.dateRangeStart,
      extraction.dateRangeEnd,
      extraction.grossAmount,
      extraction.netAmount,
      extraction.frequency,
      extraction.incomeSourceType,
      extraction.confidence,
      extraction.needsManualReview,
      extraction.reasons,
      extraction.modelVersion,
    ],
  )

  // Mark doc as complete
  await pool.query(
    `UPDATE public.income_documents
     SET extraction_status = 'complete' WHERE id = $1::uuid`,
    [extraction.documentId],
  )
}

export async function getDocumentExtraction(
  documentId: string,
): Promise<IncomeDocumentExtraction | null> {
  const pool = getDbPool()
  const { rows } = await pool.query(
    `SELECT * FROM public.income_document_extractions WHERE document_id = $1::uuid LIMIT 1`,
    [documentId],
  )
  return rows.length > 0 ? toExtraction(rows[0] as Record<string, unknown>) : null
}

// ── Decision upsert ───────────────────────────────────────────────────────────

export interface UpsertDecisionParams {
  applicationId:   string
  memberId:        string
  sourceType:      IncomeSourceType
  status:          IncomeVerificationStatus
  matchedAmount:   number | null
  matchedFrequency: string | null
  reviewerId:      string | null
  reasonCode:      string
}

export async function upsertVerificationDecision(
  params: UpsertDecisionParams,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO public.income_verification_decisions
       (application_id, member_id, source_type, status, matched_amount,
        matched_frequency, reviewer_id, reason_code, decided_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8, NOW())
     ON CONFLICT (application_id, member_id, source_type) DO UPDATE SET
       status           = EXCLUDED.status,
       matched_amount   = EXCLUDED.matched_amount,
       matched_frequency = EXCLUDED.matched_frequency,
       reviewer_id      = EXCLUDED.reviewer_id,
       reason_code      = EXCLUDED.reason_code,
       decided_at       = NOW()`,
    [
      params.applicationId,
      params.memberId,
      params.sourceType,
      params.status,
      params.matchedAmount,
      params.matchedFrequency,
      params.reviewerId,
      params.reasonCode,
    ],
  )
}

// ── Recompute ─────────────────────────────────────────────────────────────────

/**
 * Idempotent recompute: re-aggregate all decisions into the case row.
 * Safe to call after any decision change (engine or reviewer).
 */
export async function recomputeVerificationCase(
  applicationId: string,
): Promise<IncomeVerificationCase | null> {
  const pool = getDbPool()

  const { rows: reqRows } = await pool.query(
    `SELECT * FROM public.income_evidence_requirements
     WHERE application_id = $1::uuid`,
    [applicationId],
  )
  const { rows: decRows } = await pool.query(
    `SELECT * FROM public.income_verification_decisions
     WHERE application_id = $1::uuid`,
    [applicationId],
  )

  if (reqRows.length === 0) return null

  const requirements = reqRows.map((r) => toRequirement(r as Record<string, unknown>))
  const decisions    = decRows.map((r) => toDecision(r as Record<string, unknown>))

  const aggregate = computeVerificationCase(requirements, decisions)

  // Update requirement-level verification_status
  for (const req of requirements) {
    const dec = decisions.find(
      (d) => d.memberId === req.memberId && d.sourceType === req.incomeSourceType,
    )
    if (dec) {
      await pool.query(
        `UPDATE public.income_evidence_requirements
         SET verification_status = $1
         WHERE application_id = $2::uuid AND member_id = $3::uuid
           AND income_source_type = $4`,
        [dec.status, applicationId, req.memberId, req.incomeSourceType],
      )
    }
  }

  // Update case row
  await pool.query(
    `UPDATE public.income_verification_cases SET
       status                = $1,
       verified_source_count = $2,
       required_source_count = $3,
       decision_reason       = $4,
       income_verified       = $5,
       updated_at            = NOW()
     WHERE application_id = $6::uuid`,
    [
      aggregate.status,
      aggregate.verifiedSourceCount,
      aggregate.requiredSourceCount,
      aggregate.decisionReason,
      aggregate.incomeVerified,
      applicationId,
    ],
  )

  return {
    applicationId,
    ...aggregate,
    requirements,
    decisions,
  }
}

// ── RFI ───────────────────────────────────────────────────────────────────────

export interface InsertRfiParams {
  applicationId: string
  reasonCode:    string
  requestedDocs: IncomeDocType[]
  createdBy:     string
}

export async function insertRfiEvent(params: InsertRfiParams): Promise<IncomeRfiEvent> {
  const pool = getDbPool()
  const { rows } = await pool.query(
    `INSERT INTO public.income_rfi_events
       (application_id, reason_code, requested_docs, created_by)
     VALUES ($1::uuid, $2, $3, $4::uuid)
     RETURNING *`,
    [
      params.applicationId,
      params.reasonCode,
      params.requestedDocs,
      params.createdBy,
    ],
  )
  const row = rows[0] as Record<string, unknown>
  return {
    id:            String(row.id),
    applicationId: String(row.application_id),
    reasonCode:    String(row.reason_code),
    requestedDocs: (row.requested_docs as IncomeDocType[]) ?? [],
    sentAt:        String(row.sent_at),
    resolvedAt:    (row.resolved_at as string | null) ?? null,
  }
}

export async function listRfiEvents(
  applicationId: string,
): Promise<IncomeRfiEvent[]> {
  const pool = getDbPool()
  const { rows } = await pool.query(
    `SELECT * FROM public.income_rfi_events
     WHERE application_id = $1::uuid
     ORDER BY sent_at DESC`,
    [applicationId],
  )
  return rows.map((row) => {
    const r = row as Record<string, unknown>
    return {
      id:            String(r.id),
      applicationId: String(r.application_id),
      reasonCode:    String(r.reason_code),
      requestedDocs: (r.requested_docs as IncomeDocType[]) ?? [],
      sentAt:        String(r.sent_at),
      resolvedAt:    (r.resolved_at as string | null) ?? null,
    }
  })
}
