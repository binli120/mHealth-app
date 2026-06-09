/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import { APPLICATION_STATUS_SET } from "@/lib/application-status"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Defense-in-depth: remove PHI keys from wizardState before any DB write.
 * The client is responsible for keeping PHI in the encrypted resume token,
 * but this guard ensures PHI is never persisted even if a client bug slips
 * through. Mirrors the keys in lib/phi-token/phi-fields.ts (server-side copy
 * avoids importing a browser-crypto module from server-only code).
 */
const SERVER_PHI_DATA_KEYS = new Set(["contact", "preApp", "persons"])

function stripPhiFromWizardState(
  wizardState: Record<string, unknown>,
): Record<string, unknown> {
  const data = wizardState.data
  if (!data || typeof data !== "object") {
    return wizardState
  }

  const safeData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!SERVER_PHI_DATA_KEYS.has(key)) {
      safeData[key] = value
    }
  }

  return { ...wizardState, data: safeData }
}

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
  /** UUID used as Supabase Storage lookup key for the encrypted PHI blob. Null if no blob saved. */
  phiDraftResumeId: string | null
  /** Server-encrypted AES key for the PHI blob. Non-null when the user opted to store the key server-side. */
  phiDraftKeyEnc: string | null
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
  /** True when an encrypted PHI blob exists for this draft. */
  phiDraftLocked: boolean
  /** True when a social worker has modified this application and the customer has not yet confirmed. */
  needsCustomerReview: boolean
  /** ISO timestamp of the last SW-made save, or null if none. */
  swLastModifiedAt: string | null
}

export interface ApplicationDraftListResult {
  records: ApplicationDraftSummary[]
  total: number
}

export interface AppliedApplicationForPolicyUpdates {
  id: string
  status: string
  applicationType: string | null
  draftState: Record<string, unknown> | null
  submittedAt: string | null
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
    draftStep: parseIntOrNull(row.draft_step),
    lastSavedAt: (row.last_saved_at as string | null) ?? null,
    submittedAt: (row.submitted_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    phiDraftResumeId: (row.phi_draft_resume_id as string | null) ?? null,
    phiDraftKeyEnc: (row.phi_draft_key_enc as string | null) ?? null,
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
    phiDraftLocked: Boolean(row.phi_draft_locked),
    needsCustomerReview: Boolean(row.needs_customer_review),
    swLastModifiedAt: (row.sw_last_modified_at as string | null) ?? null,
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
        updated_at,
        phi_draft_resume_id,
        phi_draft_key_enc
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
        (phi_draft_resume_id IS NOT NULL AND phi_draft_key_enc IS NOT NULL) AS phi_draft_locked,
        needs_customer_review,
        sw_last_modified_at,
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

export async function listAppliedApplicationsForPolicyUpdates(
  userId: string,
  limit = 5,
): Promise<AppliedApplicationForPolicyUpdates[]> {
  const applicantId = await findApplicantIdForUser(userId)
  if (!applicantId) {
    return []
  }

  const pool = getDbPool()
  const { rows } = await pool.query(
    `
      SELECT
        id,
        status,
        application_type,
        draft_state,
        submitted_at
      FROM public.applications
      WHERE applicant_id = $1::uuid
      ORDER BY COALESCE(submitted_at, last_saved_at, updated_at, created_at) DESC
      LIMIT $2::int
    `,
    [applicantId, Math.max(1, Math.min(20, Math.trunc(limit)))],
  )

  return rows.map((row) => ({
    id: String(row.id),
    status: String(row.status),
    applicationType: (row.application_type as string | null) ?? null,
    draftState: (row.draft_state as Record<string, unknown> | null) ?? null,
    submittedAt: (row.submitted_at as string | null) ?? null,
  }))
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
  const safeWizardState = stripPhiFromWizardState(params.wizardState)
  const currentStepRaw = safeWizardState.currentStep
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
  const submitted = Boolean(safeWizardState.submitted)
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
        -- Only advance draft_state / draft_step; never let a low-step save
        -- (e.g. intake-chat initialising at step 1) overwrite higher wizard progress.
        draft_state = CASE
          WHEN COALESCE(public.applications.draft_step, 0) <= $6::int THEN $5::jsonb
          ELSE public.applications.draft_state
        END,
        draft_step = GREATEST(COALESCE(public.applications.draft_step, 0), $6::int),
        last_saved_at = now(),
        needs_customer_review = CASE WHEN $7::uuid IS NOT NULL THEN true ELSE public.applications.needs_customer_review END,
        sw_last_modified_at   = CASE WHEN $7::uuid IS NOT NULL THEN now() ELSE public.applications.sw_last_modified_at END,
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
        updated_at,
        phi_draft_resume_id
    `,
    [
      params.applicationId,
      applicantId,
      nextStatus,
      params.applicationType ?? null,
      JSON.stringify(safeWizardState),
      normalizedStep,
      params.actingForUserId ?? null,  // $7 — sets SW flags when non-null
    ],
  )

  if (rows.length === 0) {
    throw new ApplicationDraftAccessError()
  }

  return toRecord(rows[0] as Record<string, unknown>)
}

/**
 * Atomically set phi_draft_resume_id and return the previous value (for
 * cleaning up the old Supabase Storage blob before uploading a new one).
 */
export async function swapPhiDraftResumeId(params: {
  userId: string
  applicationId: string
  newResumeId: string
  /** Server-encrypted AES key to store alongside the resume ID. */
  keyEnc?: string | null
  actingForUserId?: string
}): Promise<{ previousResumeId: string | null }> {
  assertUuid(params.applicationId)
  assertUuid(params.newResumeId)
  const applicantId = params.actingForUserId
    ? await resolveApplicantIdWithSwAccess(params.userId, params.actingForUserId)
    : await requireApplicantIdForUser(params.userId)
  const pool = getDbPool()

  const { rows } = await pool.query<{ old_id: string | null }>(
    `
      UPDATE public.applications
      SET
        phi_draft_resume_id = $1::uuid,
        phi_draft_key_enc   = $4
      WHERE id = $2::uuid
        AND applicant_id = $3::uuid
      RETURNING (
        SELECT phi_draft_resume_id
        FROM public.applications
        WHERE id = $2::uuid
      ) AS old_id
    `,
    [params.newResumeId, params.applicationId, applicantId, params.keyEnc ?? null],
  )

  if (rows.length === 0) {
    throw new ApplicationDraftAccessError()
  }

  return { previousResumeId: rows[0]?.old_id ?? null }
}

/**
 * Verify that the given resumeId matches what is stored on the application row.
 * Used by the phi-draft download route to gate access to the storage blob.
 */
export async function verifyPhiDraftResumeId(params: {
  userId: string
  applicationId: string
  resumeId: string
  actingForUserId?: string
}): Promise<boolean> {
  assertUuid(params.applicationId)
  const applicantId = params.actingForUserId
    ? await resolveApplicantIdWithSwAccess(params.userId, params.actingForUserId).catch(() => null)
    : await findApplicantIdForUser(params.userId)
  if (!applicantId) return false
  const pool = getDbPool()

  const { rows } = await pool.query<{ match: boolean }>(
    `
      SELECT phi_draft_resume_id = $1::uuid AS match
      FROM public.applications
      WHERE id = $2::uuid
        AND applicant_id = $3::uuid
      LIMIT 1
    `,
    [params.resumeId, params.applicationId, applicantId],
  )

  return Boolean(rows[0]?.match)
}

const DELETABLE_STATUSES = new Set(["draft", "submitted", "ai_extracted", "needs_review", "rfi_requested"])

/**
 * Hard-delete an application record owned by the user.
 * Only allowed when the application is not in a terminal state (approved/denied).
 * Returns true if a row was deleted, false if not found or status is not deletable.
 */
export async function deleteApplicationDraft(params: {
  userId: string
  applicationId: string
  actingForUserId?: string
}): Promise<{ deleted: boolean; reason?: string }> {
  assertUuid(params.applicationId)
  const applicantId = params.actingForUserId
    ? await resolveApplicantIdWithSwAccess(params.userId, params.actingForUserId)
    : await requireApplicantIdForUser(params.userId)
  const pool = getDbPool()

  const check = await pool.query<{ status: string }>(
    `SELECT status FROM public.applications WHERE id = $1::uuid AND applicant_id = $2::uuid`,
    [params.applicationId, applicantId],
  )

  if (check.rows.length === 0) return { deleted: false, reason: "not_found" }
  if (!DELETABLE_STATUSES.has(check.rows[0].status)) {
    return { deleted: false, reason: "status_not_deletable" }
  }

  await pool.query(
    `DELETE FROM public.applications WHERE id = $1::uuid AND applicant_id = $2::uuid`,
    [params.applicationId, applicantId],
  )

  return { deleted: true }
}

/** Clear phi_draft_resume_id (called after the blob is deleted from storage). */
export async function clearPhiDraftResumeId(params: {
  userId: string
  applicationId: string
  actingForUserId?: string
}): Promise<void> {
  assertUuid(params.applicationId)
  const applicantId = params.actingForUserId
    ? await resolveApplicantIdWithSwAccess(params.userId, params.actingForUserId)
    : await requireApplicantIdForUser(params.userId)
  const pool = getDbPool()

  await pool.query(
    `
      UPDATE public.applications
      SET phi_draft_resume_id = NULL,
          phi_draft_key_enc   = NULL
      WHERE id = $1::uuid
        AND applicant_id = $2::uuid
    `,
    [params.applicationId, applicantId],
  )
}

/**
 * Clear the needs_customer_review flag after the customer confirms SW-made changes.
 * Only clears if the application belongs to the given patient.
 */
export async function confirmCustomerReview(
  applicationId: string,
  patientUserId: string,
): Promise<void> {
  assertUuid(applicationId)
  const applicantId = await findApplicantIdForUser(patientUserId)
  if (!applicantId) return
  const pool = getDbPool()
  await pool.query(
    `UPDATE public.applications
        SET needs_customer_review = false
      WHERE id = $1::uuid
        AND applicant_id = $2::uuid`,
    [applicationId, applicantId],
  )
}
