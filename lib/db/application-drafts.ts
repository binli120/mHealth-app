/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import { APPLICATION_STATUS_SET } from "@/lib/application-status"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ApplicationDraftRecord {
  id: string
  status: string
  applicationType: string | null
  draftState: Record<string, unknown> | null
  draftStep: number | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ApplicationDraftSummary {
  id: string
  status: string
  applicationType: string | null
  draftStep: number | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  applicantName: string | null
  householdSize: number | null
}

export interface ApplicationDraftListResult {
  records: ApplicationDraftSummary[]
  total: number
}

export interface ApplicationDraftListFilters {
  status?: string | null
  query?: string | null
  limit?: number
  offset?: number
}

// Keep in sync with applications_draft_step_range_check in SQL migrations.
export const MAX_APPLICATION_DRAFT_STEP = 9

export class ApplicationDraftAccessError extends Error {
  constructor(message = "Application draft is not accessible for this user.") {
    super(message)
    this.name = "ApplicationDraftAccessError"
  }
}

function isApplicationStatus(value: string): boolean {
  return APPLICATION_STATUS_SET.has(value)
}

function assertUuid(applicationId: string): void {
  if (!UUID_PATTERN.test(applicationId)) {
    throw new Error("Invalid applicationId. Must be a UUID.")
  }
}

async function findApplicantIdForUser(userId: string): Promise<string | null> {
  assertUuid(userId)
  const pool = getDbPool()
  const { rows } = await pool.query(
    `
      SELECT id
      FROM public.applicants
      WHERE user_id = $1::uuid
      LIMIT 1
    `,
    [userId],
  )

  if (rows.length === 0) {
    return null
  }

  return String(rows[0].id)
}

async function requireApplicantIdForUser(userId: string): Promise<string> {
  const applicantId = await findApplicantIdForUser(userId)
  if (!applicantId) {
    throw new ApplicationDraftAccessError("Applicant profile was not found for the current user.")
  }

  return applicantId
}

/**
 * When a social worker acts on behalf of a patient, verify they have active
 * access and return the *patient's* applicant ID to use in DB queries.
 */
async function resolveApplicantIdWithSwAccess(
  swUserId: string,
  patientUserId: string,
): Promise<string> {
  assertUuid(swUserId)
  assertUuid(patientUserId)
  const pool = getDbPool()

  const accessCheck = await pool.query<{ has_access: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.patient_social_worker_access
       WHERE patient_user_id  = $1::uuid
         AND social_worker_user_id = $2::uuid
         AND is_active = true
     ) AS has_access`,
    [patientUserId, swUserId],
  )

  if (!accessCheck.rows[0]?.has_access) {
    throw new ApplicationDraftAccessError(
      "Social worker does not have active access to this patient.",
    )
  }

  return requireApplicantIdForUser(patientUserId)
}

function parseIntOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (value === null || value === undefined || value === "") {
    return null
  }

  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeStatusFilter(status?: string | null): string | null {
  if (!status) {
    return null
  }

  const normalized = status.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (!isApplicationStatus(normalized)) {
    throw new Error("Invalid status filter.")
  }

  return normalized
}

function normalizeListLimit(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 50
  }

  return Math.min(100, Math.max(1, Math.trunc(value)))
}

function normalizeListOffset(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.trunc(value))
}

function toRecord(row: Record<string, unknown>): ApplicationDraftRecord {
  return {
    id: String(row.id),
    status: String(row.status),
    applicationType: (row.application_type as string | null) ?? null,
    draftState: (row.draft_state as Record<string, unknown> | null) ?? null,
    draftStep:
      parseIntOrNull(row.draft_step),
    lastSavedAt: (row.last_saved_at as string | null) ?? null,
    submittedAt: (row.submitted_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function toSummary(row: Record<string, unknown>): ApplicationDraftSummary {
  return {
    id: String(row.id),
    status: String(row.status),
    applicationType: (row.application_type as string | null) ?? null,
    draftStep: parseIntOrNull(row.draft_step),
    lastSavedAt: (row.last_saved_at as string | null) ?? null,
    submittedAt: (row.submitted_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    applicantName: (row.applicant_name as string | null) ?? null,
    householdSize: parseIntOrNull(row.household_size),
  }
}

export async function createApplicationDraft(params: {
  userId: string
  applicationId: string
  applicationType?: string
  /** Social worker acting on behalf of this patient user ID */
  actingForUserId?: string
}) {
  assertUuid(params.applicationId)
  const applicantId = params.actingForUserId
    ? await resolveApplicantIdWithSwAccess(params.userId, params.actingForUserId)
    : await requireApplicantIdForUser(params.userId)
  const pool = getDbPool()

  const { rows } = await pool.query(
    `
      INSERT INTO public.applications (
        id,
        applicant_id,
        status,
        application_type,
        last_saved_at
      )
      VALUES ($1::uuid, $2::uuid, 'draft', NULLIF($3::text, ''), now())
      ON CONFLICT (id) DO UPDATE
      SET
        application_type = COALESCE(NULLIF($3::text, ''), public.applications.application_type),
        last_saved_at = COALESCE(public.applications.last_saved_at, now())
      WHERE public.applications.applicant_id = $2::uuid
      RETURNING
        id,
        status,
        application_type,
        draft_state,
        draft_step,
        last_saved_at,
        submitted_at,
        created_at,
        updated_at
    `,
    [params.applicationId, applicantId, params.applicationType ?? null],
  )

  if (rows.length === 0) {
    throw new ApplicationDraftAccessError()
  }

  return toRecord(rows[0] as Record<string, unknown>)
}

export async function getApplicationDraft(
  userId: string,
  applicationId: string,
  actingForUserId?: string,
) {
  assertUuid(applicationId)
  const applicantId = actingForUserId
    ? await resolveApplicantIdWithSwAccess(userId, actingForUserId).catch(() => null)
    : await findApplicantIdForUser(userId)
  if (!applicantId) {
    return null
  }

  const pool = getDbPool()

  const { rows } = await pool.query(
    `
      SELECT
        id,
        status,
        application_type,
        draft_state,
        draft_step,
        last_saved_at,
        submitted_at,
        created_at,
        updated_at
      FROM public.applications
      WHERE id = $1::uuid
        AND applicant_id = $2::uuid
      LIMIT 1
    `,
    [applicationId, applicantId],
  )

  if (rows.length === 0) {
    return null
  }

  return toRecord(rows[0] as Record<string, unknown>)
}

export async function listApplicationDrafts(
  userId: string,
  filters: ApplicationDraftListFilters = {},
): Promise<ApplicationDraftListResult> {
  const applicantId = await findApplicantIdForUser(userId)
  if (!applicantId) {
    return {
      records: [],
      total: 0,
    }
  }

  const pool = getDbPool()
  const status = normalizeStatusFilter(filters.status)
  const query = filters.query?.trim() ? filters.query.trim() : null
  const limit = normalizeListLimit(filters.limit)
  const offset = normalizeListOffset(filters.offset)

  const { rows } = await pool.query(
    `
      SELECT
        id,
        status,
        application_type,
        draft_step,
        last_saved_at,
        submitted_at,
        created_at,
        updated_at,
        NULLIF(TRIM(COALESCE(draft_state #>> '{data,contact,p1_name}', '')), '') AS applicant_name,
        NULLIF(TRIM(COALESCE(draft_state #>> '{data,contact,p1_num_people}', '')), '') AS household_size,
        COUNT(*) OVER() AS total_count
      FROM public.applications
      WHERE applicant_id = $1::uuid
        AND ($2::application_status IS NULL OR status = $2::application_status)
        AND (
          $3::text IS NULL
          OR id::text ILIKE '%' || $3::text || '%'
          OR COALESCE(application_type, '') ILIKE '%' || $3::text || '%'
          OR COALESCE(draft_state #>> '{data,contact,p1_name}', '') ILIKE '%' || $3::text || '%'
        )
      ORDER BY COALESCE(last_saved_at, updated_at, created_at) DESC
      LIMIT $4::int
      OFFSET $5::int
    `,
    [applicantId, status, query, limit, offset],
  )

  if (rows.length === 0) {
    return {
      records: [],
      total: 0,
    }
  }

  return {
    records: rows.map((row) => toSummary(row as Record<string, unknown>)),
    total: parseIntOrNull(rows[0]?.total_count) ?? rows.length,
  }
}

export async function upsertApplicationDraft(params: {
  userId: string
  applicationId: string
  applicationType?: string
  wizardState: Record<string, unknown>
  /** Social worker acting on behalf of this patient user ID */
  actingForUserId?: string
}) {
  assertUuid(params.applicationId)
  const applicantId = params.actingForUserId
    ? await resolveApplicantIdWithSwAccess(params.userId, params.actingForUserId)
    : await requireApplicantIdForUser(params.userId)
  const pool = getDbPool()
  const currentStepRaw = params.wizardState.currentStep
  const currentStep =
    typeof currentStepRaw === "number"
      ? currentStepRaw
      : Number.parseInt(String(currentStepRaw ?? ""), 10)
  const normalizedStep =
    Number.isFinite(currentStep) &&
    currentStep >= 1 &&
    currentStep <= MAX_APPLICATION_DRAFT_STEP
      ? currentStep
      : null
  const submitted = Boolean(params.wizardState.submitted)
  const nextStatus = submitted ? "submitted" : "draft"

  const { rows } = await pool.query(
    `
      INSERT INTO public.applications (
        id,
        applicant_id,
        status,
        application_type,
        draft_state,
        draft_step,
        last_saved_at,
        submitted_at
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::application_status,
        NULLIF($4::text, ''),
        $5::jsonb,
        $6::int,
        now(),
        CASE WHEN $3::application_status = 'submitted' THEN now() ELSE NULL END
      )
      ON CONFLICT (id) DO UPDATE
      SET
        status = CASE
          WHEN public.applications.status IN ('approved', 'denied') THEN public.applications.status
          WHEN $3::application_status = 'submitted' THEN 'submitted'::application_status
          ELSE 'draft'::application_status
        END,
        application_type = COALESCE(NULLIF($4::text, ''), public.applications.application_type),
        draft_state = $5::jsonb,
        draft_step = $6::int,
        last_saved_at = now(),
        submitted_at = CASE
          WHEN $3::application_status = 'submitted'
            THEN COALESCE(public.applications.submitted_at, now())
          ELSE public.applications.submitted_at
        END
      WHERE public.applications.applicant_id = $2::uuid
      RETURNING
        id,
        status,
        application_type,
        draft_state,
        draft_step,
        last_saved_at,
        submitted_at,
        created_at,
        updated_at
    `,
    [
      params.applicationId,
      applicantId,
      nextStatus,
      params.applicationType ?? null,
      JSON.stringify(params.wizardState),
      normalizedStep,
    ],
  )

  if (rows.length === 0) {
    throw new ApplicationDraftAccessError()
  }

  return toRecord(rows[0] as Record<string, unknown>)
}
