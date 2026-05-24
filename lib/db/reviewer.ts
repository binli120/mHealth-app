/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import {
  APPLICATION_STATUS_SET,
  type ApplicationStatus,
} from "@/lib/application-status"
import {
  APPLICANT_NAME_SELECT,
  APPLICANT_PHI_SELECT,
  decryptDisplayName,
  decryptOrPlain,
} from "@/lib/db/applicant-fields"
import { getDbPool } from "@/lib/db/server"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const REVIEW_STATUSES = new Set(["submitted", "ai_extracted", "needs_review", "rfi_requested"])
const FLAGGED_VALIDATION_STATUSES = ["pending", "analyzing", "invalid", "error"] as const

export interface ReviewerStats {
  total: number
  pendingReview: number
  rfiRequired: number
  approved: number
  flagged: number
  agingOverSeven: number
}

export interface ReviewerCaseSummary {
  id: string
  displayId: string
  applicantName: string
  applicantEmail: string | null
  applicantPhone: string | null
  applicationType: string | null
  status: string
  householdSize: number | null
  totalMonthlyIncome: number | null
  confidenceScore: number | null
  fplPercentage: number | null
  estimatedProgram: string | null
  documentCount: number
  pendingDocumentCount: number
  openValidationCount: number
  createdAt: string
  updatedAt: string | null
  submittedAt: string | null
  decidedAt: string | null
  lastActivityAt: string
  ageDays: number
  flags: string[]
}

export interface ReviewerDocument {
  id: string
  documentType: string | null
  requiredDocumentLabel: string | null
  fileName: string | null
  fileUrl: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  documentStatus: string
  validationStatus: string
  validationError: string | null
  validationSummary: Record<string, unknown> | null
  analysisDocumentType: string | null
  extractionConfidence: number | null
  uploadedAt: string
  analyzedAt: string | null
}

export interface ReviewerValidationResult {
  id: string
  ruleName: string | null
  severity: string | null
  message: string
  resolved: boolean
  createdAt: string
}

export interface ReviewerAuditEvent {
  id: string
  applicationId: string
  applicationDisplayId: string
  applicantName: string
  action: string
  actorEmail: string | null
  actorRole: string
  details: string
  occurredAt: string
}

export interface ReviewerCaseDetail extends ReviewerCaseSummary {
  applicantDob: string | null
  applicantAddress: {
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    zip: string | null
  }
  citizenshipStatus: string | null
  draftState: Record<string, unknown> | null
  documents: ReviewerDocument[]
  validationResults: ReviewerValidationResult[]
  auditEvents: ReviewerAuditEvent[]
}

export interface ReviewerCaseFilters {
  status?: string | null
  query?: string | null
  agingDays?: number | null
  flagged?: boolean
  excludeDrafts?: boolean
  limit?: number
  offset?: number
}

export interface ReviewerCaseListResult {
  records: ReviewerCaseSummary[]
  total: number
}

function normalizeLimit(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 25
  return Math.min(100, Math.max(1, Math.trunc(value)))
}

function normalizeOffset(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function normalizeStatus(value?: string | null): ApplicationStatus | null {
  if (!value) return null
  const normalized = value.trim()
  return APPLICATION_STATUS_SET.has(normalized) ? (normalized as ApplicationStatus) : null
}

function toIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toInt(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

function displayId(applicationId: string): string {
  return applicationId.slice(0, 8).toUpperCase()
}

function daysSince(value: string | null): number {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
}

function fallbackApplicantName(row: Record<string, unknown>): string {
  return (
    decryptDisplayName(
      row.first_name_encrypted as string | null,
      row.last_name_encrypted as string | null,
    ) ??
    ((row.applicant_email as string | null) || null) ??
    "Unknown applicant"
  )
}

function buildFlags(params: {
  status: string
  confidenceScore: number | null
  pendingDocumentCount: number
  openValidationCount: number
  ageDays: number
}): string[] {
  const flags: string[] = []
  if (params.status === "rfi_requested") flags.push("RFI outstanding")
  if (params.pendingDocumentCount > 0) flags.push("Document review")
  if (params.openValidationCount > 0) flags.push("Validation warning")
  if (params.confidenceScore !== null && params.confidenceScore < 75) flags.push("Low confidence")
  if (REVIEW_STATUSES.has(params.status) && params.ageDays >= 7) flags.push("Aging")
  return flags
}

function toCaseSummary(row: Record<string, unknown>): ReviewerCaseSummary {
  const id = String(row.id)
  const createdAt = toIso(row.created_at) ?? new Date(0).toISOString()
  const updatedAt = toIso(row.updated_at)
  const submittedAt = toIso(row.submitted_at)
  const decidedAt = toIso(row.decided_at)
  const lastActivityAt =
    toIso(row.last_activity_at) ?? submittedAt ?? updatedAt ?? createdAt
  const ageDays = daysSince(submittedAt ?? createdAt)
  const status = String(row.status)
  const confidenceScore = toNumber(row.confidence_score)
  const pendingDocumentCount = toInt(row.pending_document_count)
  const openValidationCount = toInt(row.open_validation_count)

  return {
    id,
    displayId: displayId(id),
    applicantName: fallbackApplicantName(row),
    applicantEmail: (row.applicant_email as string | null) ?? null,
    applicantPhone: decryptOrPlain(row.phone_encrypted as string | null),
    applicationType: (row.application_type as string | null) ?? null,
    status,
    householdSize: toNumber(row.household_size),
    totalMonthlyIncome: toNumber(row.total_monthly_income),
    confidenceScore,
    fplPercentage: toNumber(row.fpl_percentage),
    estimatedProgram: (row.estimated_program as string | null) ?? null,
    documentCount: toInt(row.document_count),
    pendingDocumentCount,
    openValidationCount,
    createdAt,
    updatedAt,
    submittedAt,
    decidedAt,
    lastActivityAt,
    ageDays,
    flags: buildFlags({
      status,
      confidenceScore,
      pendingDocumentCount,
      openValidationCount,
      ageDays,
    }),
  }
}

export async function listReviewerCases(filters: ReviewerCaseFilters = {}): Promise<ReviewerCaseListResult> {
  const pool = getDbPool()
  const params: unknown[] = []
  const where: string[] = []
  const status = normalizeStatus(filters.status)
  const query = filters.query?.trim() ? filters.query.trim() : null
  const agingDays =
    typeof filters.agingDays === "number" && Number.isFinite(filters.agingDays)
      ? Math.max(0, Math.trunc(filters.agingDays))
      : null

  const addParam = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  if (status) {
    where.push(`a.status = ${addParam(status)}::application_status`)
  } else if (filters.excludeDrafts) {
    where.push("a.status <> 'draft'::application_status")
  }

  if (query) {
    const placeholder = addParam(query)
    where.push(`(
      a.id::text ILIKE '%' || ${placeholder}::text || '%'
      OR COALESCE(a.application_type, '') ILIKE '%' || ${placeholder}::text || '%'
      OR COALESCE(u.email, '') ILIKE '%' || ${placeholder}::text || '%'
      OR COALESCE(a.draft_state #>> '{data,contact,p1_name}', '') ILIKE '%' || ${placeholder}::text || '%'
    )`)
  }

  if (filters.flagged) {
    where.push(`(
      a.confidence_score < 75
      OR COALESCE(dc.pending_document_count, 0) > 0
      OR COALESCE(vc.open_validation_count, 0) > 0
    )`)
  }

  if (agingDays !== null && agingDays > 0) {
    where.push(`COALESCE(a.submitted_at, a.created_at) <= NOW() - (${addParam(agingDays)}::int * INTERVAL '1 day')`)
  }

  const limitPlaceholder = addParam(normalizeLimit(filters.limit))
  const offsetPlaceholder = addParam(normalizeOffset(filters.offset))
  const whereSql = where.length > 0 ? `WHERE ${where.join("\n        AND ")}` : ""

  const result = await pool.query(
    `
      WITH doc_counts AS (
        SELECT
          d.application_id,
          COUNT(*)::int AS document_count,
          COUNT(*) FILTER (
            WHERE d.document_status = 'pending_review'
               OR d.validation_status = ANY($${params.length + 1}::text[])
          )::int AS pending_document_count
        FROM public.documents d
        GROUP BY d.application_id
      ),
      validation_counts AS (
        SELECT
          vr.application_id,
          COUNT(*) FILTER (WHERE vr.resolved = false)::int AS open_validation_count
        FROM public.validation_results vr
        GROUP BY vr.application_id
      )
      SELECT
        a.id,
        a.status,
        a.application_type,
        a.household_size,
        a.total_monthly_income,
        a.confidence_score,
        a.created_at,
        a.updated_at,
        a.submitted_at,
        a.decided_at,
        COALESCE(a.submitted_at, a.last_saved_at, a.updated_at, a.created_at) AS last_activity_at,
        u.email AS applicant_email,
        ${APPLICANT_PHI_SELECT("ap")},
        es.fpl_percentage,
        es.estimated_program,
        COALESCE(dc.document_count, 0)::int AS document_count,
        COALESCE(dc.pending_document_count, 0)::int AS pending_document_count,
        COALESCE(vc.open_validation_count, 0)::int AS open_validation_count,
        COUNT(*) OVER() AS total_count
      FROM public.applications a
      LEFT JOIN public.applicants ap ON ap.id = a.applicant_id
      LEFT JOIN public.users u ON u.id = ap.user_id
      LEFT JOIN doc_counts dc ON dc.application_id = a.id
      LEFT JOIN validation_counts vc ON vc.application_id = a.id
      LEFT JOIN LATERAL (
        SELECT fpl_percentage, estimated_program
        FROM public.eligibility_screenings
        WHERE application_id = a.id
        ORDER BY created_at DESC
        LIMIT 1
      ) es ON true
      ${whereSql}
      ORDER BY COALESCE(a.submitted_at, a.last_saved_at, a.updated_at, a.created_at) DESC
      LIMIT ${limitPlaceholder}::int
      OFFSET ${offsetPlaceholder}::int
    `,
    [...params, FLAGGED_VALIDATION_STATUSES],
  )

  return {
    records: result.rows.map((row) => toCaseSummary(row as Record<string, unknown>)),
    total: toInt(result.rows[0]?.total_count),
  }
}

export async function getReviewerStats(): Promise<ReviewerStats> {
  const pool = getDbPool()
  const result = await pool.query<{
    total: number
    pending_review: number
    rfi_required: number
    approved: number
    flagged: number
    aging_over_seven: number
  }>(
    `
      WITH doc_counts AS (
        SELECT
          d.application_id,
          COUNT(*) FILTER (
            WHERE d.document_status = 'pending_review'
               OR d.validation_status = ANY($1::text[])
          )::int AS pending_document_count
        FROM public.documents d
        GROUP BY d.application_id
      ),
      validation_counts AS (
        SELECT
          application_id,
          COUNT(*) FILTER (WHERE resolved = false)::int AS open_validation_count
        FROM public.validation_results
        GROUP BY application_id
      ),
      per_case AS (
        SELECT
          a.status::text AS status,
          a.confidence_score,
          COALESCE(dc.pending_document_count, 0)::int AS pending_document_count,
          COALESCE(vc.open_validation_count, 0)::int AS open_validation_count,
          COALESCE(a.submitted_at, a.created_at) AS aging_start
        FROM public.applications a
        LEFT JOIN doc_counts dc ON dc.application_id = a.id
        LEFT JOIN validation_counts vc ON vc.application_id = a.id
        WHERE a.status <> 'draft'::application_status
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('submitted', 'ai_extracted', 'needs_review'))::int AS pending_review,
        COUNT(*) FILTER (WHERE status = 'rfi_requested')::int AS rfi_required,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (
          WHERE confidence_score < 75
             OR pending_document_count > 0
             OR open_validation_count > 0
        )::int AS flagged,
        COUNT(*) FILTER (
          WHERE status IN ('submitted', 'ai_extracted', 'needs_review', 'rfi_requested')
            AND aging_start <= NOW() - INTERVAL '7 days'
        )::int AS aging_over_seven
      FROM per_case
    `,
    [FLAGGED_VALIDATION_STATUSES],
  )

  const row = result.rows[0]
  return {
    total: toInt(row?.total),
    pendingReview: toInt(row?.pending_review),
    rfiRequired: toInt(row?.rfi_required),
    approved: toInt(row?.approved),
    flagged: toInt(row?.flagged),
    agingOverSeven: toInt(row?.aging_over_seven),
  }
}

export async function getReviewerDashboard(): Promise<{
  stats: ReviewerStats
  recentCases: ReviewerCaseSummary[]
}> {
  const [stats, cases] = await Promise.all([
    getReviewerStats(),
    listReviewerCases({ excludeDrafts: true, limit: 5 }),
  ])

  return { stats, recentCases: cases.records }
}

async function listReviewerDocuments(applicationId: string): Promise<ReviewerDocument[]> {
  const pool = getDbPool()
  const result = await pool.query(
    `
      SELECT
        d.id,
        d.document_type,
        d.required_document_label,
        d.file_name,
        d.file_url,
        d.file_size_bytes,
        d.mime_type,
        d.document_status,
        d.validation_status,
        d.validation_error,
        d.validation_summary,
        d.analysis_document_type,
        d.uploaded_at,
        d.analyzed_at,
        de.structured_output,
        de.confidence_score AS extraction_confidence
      FROM public.documents d
      LEFT JOIN LATERAL (
        SELECT structured_output, confidence_score
        FROM public.document_extractions
        WHERE document_id = d.id
        ORDER BY extracted_at DESC
        LIMIT 1
      ) de ON true
      WHERE d.application_id = $1::uuid
      ORDER BY d.uploaded_at DESC
    `,
    [applicationId],
  )

  return result.rows.map((row) => ({
    id: String(row.id),
    documentType: (row.document_type as string | null) ?? null,
    requiredDocumentLabel: (row.required_document_label as string | null) ?? null,
    fileName: (row.file_name as string | null) ?? null,
    fileUrl: (row.file_url as string | null) ?? null,
    fileSizeBytes: toNumber(row.file_size_bytes),
    mimeType: (row.mime_type as string | null) ?? null,
    documentStatus: String(row.document_status ?? "uploaded"),
    validationStatus: String(row.validation_status ?? "not_required"),
    validationError: (row.validation_error as string | null) ?? null,
    validationSummary:
      ((row.validation_summary ?? row.structured_output) as Record<string, unknown> | null) ?? null,
    analysisDocumentType: (row.analysis_document_type as string | null) ?? null,
    extractionConfidence: toNumber(row.extraction_confidence),
    uploadedAt: toIso(row.uploaded_at) ?? new Date(0).toISOString(),
    analyzedAt: toIso(row.analyzed_at),
  }))
}

async function listReviewerValidationResults(applicationId: string): Promise<ReviewerValidationResult[]> {
  const pool = getDbPool()
  const result = await pool.query(
    `
      SELECT id, rule_name, severity, message, resolved, created_at
      FROM public.validation_results
      WHERE application_id = $1::uuid
      ORDER BY resolved ASC, created_at DESC
    `,
    [applicationId],
  )

  return result.rows.map((row) => ({
    id: String(row.id),
    ruleName: (row.rule_name as string | null) ?? null,
    severity: (row.severity as string | null) ?? null,
    message: String(row.message ?? "Validation issue"),
    resolved: Boolean(row.resolved),
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
  }))
}

function normalizeAuditAction(action: string): string {
  return action
    .replace(/^application\./, "Application ")
    .replace(/^phi\./, "PHI ")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function toAuditEvent(row: Record<string, unknown>): ReviewerAuditEvent {
  const applicationId = String(row.application_id)
  return {
    id: String(row.id),
    applicationId,
    applicationDisplayId: displayId(applicationId),
    applicantName: fallbackApplicantName(row),
    action: normalizeAuditAction(String(row.action ?? "Audit Event")),
    actorEmail: (row.actor_email as string | null) ?? null,
    actorRole: String(row.actor_role ?? "System"),
    details: String(row.details ?? "Application activity"),
    occurredAt: toIso(row.occurred_at) ?? new Date(0).toISOString(),
  }
}

export async function listReviewerAuditEvents(options: {
  applicationId?: string
  limit?: number
} = {}): Promise<ReviewerAuditEvent[]> {
  if (options.applicationId && !UUID_PATTERN.test(options.applicationId)) {
    return []
  }

  const pool = getDbPool()
  const params: unknown[] = []
  const addParam = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  const applicationFilter = options.applicationId
    ? `a.id = ${addParam(options.applicationId)}::uuid`
    : "TRUE"
  const auditFilter = options.applicationId
    ? `al.application_id = $1::uuid`
    : "al.application_id IS NOT NULL"
  const limitPlaceholder = addParam(normalizeLimit(options.limit ?? 50))

  const result = await pool.query(
    `
      WITH events AS (
        SELECT
          'application-created-' || a.id::text AS id,
          a.id::text AS application_id,
          'application.created' AS action,
          u.email AS actor_email,
          'Applicant' AS actor_role,
          'Application record created' AS details,
          a.created_at AS occurred_at,
          ${APPLICANT_NAME_SELECT("ap")}
        FROM public.applications a
        LEFT JOIN public.applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.users u ON u.id = ap.user_id
        WHERE ${applicationFilter}

        UNION ALL

        SELECT
          'application-submitted-' || a.id::text AS id,
          a.id::text AS application_id,
          'application.submitted' AS action,
          u.email AS actor_email,
          'Applicant' AS actor_role,
          'Application submitted for review' AS details,
          a.submitted_at AS occurred_at,
          ${APPLICANT_NAME_SELECT("ap")}
        FROM public.applications a
        LEFT JOIN public.applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.users u ON u.id = ap.user_id
        WHERE a.submitted_at IS NOT NULL
          AND ${applicationFilter}

        UNION ALL

        SELECT
          'application-updated-' || a.id::text AS id,
          a.id::text AS application_id,
          'application.updated' AS action,
          u.email AS actor_email,
          'System' AS actor_role,
          'Application data changed' AS details,
          a.updated_at AS occurred_at,
          ${APPLICANT_NAME_SELECT("ap")}
        FROM public.applications a
        LEFT JOIN public.applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.users u ON u.id = ap.user_id
        WHERE a.updated_at IS NOT NULL
          AND a.updated_at > a.created_at + INTERVAL '1 second'
          AND ${applicationFilter}

        UNION ALL

        SELECT
          'document-uploaded-' || d.id::text AS id,
          a.id::text AS application_id,
          'document.uploaded' AS action,
          du.email AS actor_email,
          'Applicant' AS actor_role,
          COALESCE(d.file_name, d.required_document_label, d.document_type, 'Document uploaded') AS details,
          d.uploaded_at AS occurred_at,
          ${APPLICANT_NAME_SELECT("ap")}
        FROM public.documents d
        JOIN public.applications a ON a.id = d.application_id
        LEFT JOIN public.applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.users du ON du.id = d.uploaded_by
        WHERE ${applicationFilter}

        UNION ALL

        SELECT
          al.id::text AS id,
          al.application_id::text AS application_id,
          COALESCE(al.action, 'audit.event') AS action,
          au.email AS actor_email,
          CASE
            WHEN al.action LIKE 'application.%' THEN 'Reviewer'
            WHEN au.id IS NULL THEN 'System'
            ELSE 'User'
          END AS actor_role,
          COALESCE(
            al.new_data ->> 'notes',
            al.new_data ->> 'message',
            al.new_data ->> 'reason',
            al.action,
            'Audit event'
          ) AS details,
          al.created_at AS occurred_at,
          ${APPLICANT_NAME_SELECT("ap")}
        FROM public.audit_logs al
        JOIN public.applications a ON a.id = al.application_id
        LEFT JOIN public.applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.users au ON au.id = al.user_id
        WHERE ${auditFilter}
      )
      SELECT *
      FROM events
      WHERE occurred_at IS NOT NULL
      ORDER BY occurred_at DESC
      LIMIT ${limitPlaceholder}::int
    `,
    params,
  )

  return result.rows.map((row) => toAuditEvent(row as Record<string, unknown>))
}

export async function getReviewerCase(applicationId: string): Promise<ReviewerCaseDetail | null> {
  if (!UUID_PATTERN.test(applicationId)) {
    return null
  }

  const pool = getDbPool()
  const result = await pool.query(
    `
      WITH doc_counts AS (
        SELECT
          d.application_id,
          COUNT(*)::int AS document_count,
          COUNT(*) FILTER (
            WHERE d.document_status = 'pending_review'
               OR d.validation_status = ANY($2::text[])
          )::int AS pending_document_count
        FROM public.documents d
        WHERE d.application_id = $1::uuid
        GROUP BY d.application_id
      ),
      validation_counts AS (
        SELECT
          application_id,
          COUNT(*) FILTER (WHERE resolved = false)::int AS open_validation_count
        FROM public.validation_results
        WHERE application_id = $1::uuid
        GROUP BY application_id
      )
      SELECT
        a.id,
        a.status,
        a.application_type,
        a.household_size,
        a.total_monthly_income,
        a.confidence_score,
        a.draft_state,
        a.created_at,
        a.updated_at,
        a.submitted_at,
        a.decided_at,
        COALESCE(a.submitted_at, a.last_saved_at, a.updated_at, a.created_at) AS last_activity_at,
        u.email AS applicant_email,
        ${APPLICANT_PHI_SELECT("ap")},
        NULL::text AS citizenship_status,
        es.fpl_percentage,
        es.estimated_program,
        COALESCE(dc.document_count, 0)::int AS document_count,
        COALESCE(dc.pending_document_count, 0)::int AS pending_document_count,
        COALESCE(vc.open_validation_count, 0)::int AS open_validation_count
      FROM public.applications a
      LEFT JOIN public.applicants ap ON ap.id = a.applicant_id
      LEFT JOIN public.users u ON u.id = ap.user_id
      LEFT JOIN doc_counts dc ON dc.application_id = a.id
      LEFT JOIN validation_counts vc ON vc.application_id = a.id
      LEFT JOIN LATERAL (
        SELECT fpl_percentage, estimated_program
        FROM public.eligibility_screenings
        WHERE application_id = a.id
        ORDER BY created_at DESC
        LIMIT 1
      ) es ON true
      WHERE a.id = $1::uuid
      LIMIT 1
    `,
    [applicationId, FLAGGED_VALIDATION_STATUSES],
  )

  const row = result.rows[0] as Record<string, unknown> | undefined
  if (!row) {
    return null
  }

  const [documents, validationResults, auditEvents] = await Promise.all([
    listReviewerDocuments(applicationId),
    listReviewerValidationResults(applicationId),
    listReviewerAuditEvents({ applicationId, limit: 25 }),
  ])
  const summary = toCaseSummary(row)

  return {
    ...summary,
    applicantDob: decryptOrPlain(row.dob_encrypted as string | null),
    applicantAddress: {
      line1: decryptOrPlain(row.address_line1_encrypted as string | null),
      line2: decryptOrPlain(row.address_line2_encrypted as string | null),
      city: decryptOrPlain(row.city_encrypted as string | null),
      state: decryptOrPlain(row.state_encrypted as string | null),
      zip: decryptOrPlain(row.zip_encrypted as string | null),
    },
    citizenshipStatus: null,
    draftState: (row.draft_state as Record<string, unknown> | null) ?? null,
    documents,
    validationResults,
    auditEvents,
  }
}
