/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import {
  decryptOrPlain,
  decryptDisplayName,
  APPLICANT_PHI_SELECT,
  APPLICANT_PHI_GROUP_BY,
} from "@/lib/db/applicant-fields"

export interface SwPatient {
  access_id: string
  patient_user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  dob: string | null
  phone: string | null
  city: string | null
  state: string | null
  zip: string | null
  citizenship_status: string | null
  granted_at: string
  application_count: number
  latest_application_status: string | null
}

export interface SwApplicationSummary {
  id: string
  status: string
  application_type: string | null
  draft_step: number | null
  household_size: number | null
  total_monthly_income: number | null
  applicant_name: string | null
  created_at: string
  updated_at: string
  submitted_at: string | null
}

export interface SwProfile {
  id: string
  user_id: string
  company_id: string
  company_name: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  bio: string | null
  avatar_url: string | null
  license_number: string | null
  job_title: string | null
  status: "pending" | "approved" | "rejected"
  rejection_note: string | null
}

export async function getSwProfile(userId: string): Promise<SwProfile | null> {
  const pool = getDbPool()
  const result = await pool.query<SwProfile>(
    `
      SELECT
        swp.id, swp.user_id, swp.company_id, c.name AS company_name,
        swp.first_name, swp.last_name, swp.phone, swp.bio, swp.avatar_url,
        swp.license_number, swp.job_title, swp.status, swp.rejection_note
      FROM public.social_worker_profiles swp
      JOIN public.companies c ON c.id = swp.company_id
      WHERE swp.user_id = $1::uuid
    `,
    [userId],
  )
  return result.rows[0] ?? null
}

export async function getSwPatients(swUserId: string): Promise<SwPatient[]> {
  const pool = getDbPool()

  // PHI columns are selected in dual form (encrypted + legacy plaintext) via
  // APPLICANT_PHI_SELECT so that pre-backfill rows still resolve correctly.
  const result = await pool.query<{
    access_id: string
    patient_user_id: string
    email: string
    // Encrypted columns
    first_name_encrypted: string | null
    last_name_encrypted: string | null
    dob_encrypted: string | null
    phone_encrypted: string | null
    city_encrypted: string | null
    state_encrypted: string | null
    zip_encrypted: string | null
    // Legacy plaintext fallback
    first_name: string | null
    last_name: string | null
    dob: string | null
    phone: string | null
    city: string | null
    state: string | null
    zip: string | null
    // Non-PHI
    citizenship_status: string | null
    granted_at: string
    application_count: number
    latest_application_status: string | null
  }>(
    `
      SELECT
        psa.id AS access_id,
        psa.patient_user_id,
        u.email,
        ${APPLICANT_PHI_SELECT("ap")},
        ap.citizenship_status,
        psa.granted_at,
        COUNT(a.id)::int AS application_count,
        (
          SELECT a2.status
          FROM public.applications a2
          JOIN public.applicants ap2 ON ap2.id = a2.applicant_id
          WHERE ap2.user_id = psa.patient_user_id
          ORDER BY a2.created_at DESC
          LIMIT 1
        ) AS latest_application_status
      FROM public.patient_social_worker_access psa
      JOIN public.users u ON u.id = psa.patient_user_id
      LEFT JOIN public.applicants ap ON ap.user_id = psa.patient_user_id
      LEFT JOIN public.applications a ON a.applicant_id = ap.id
      WHERE psa.social_worker_user_id = $1::uuid
        AND psa.is_active = true
      GROUP BY psa.id, psa.patient_user_id, u.email,
               ${APPLICANT_PHI_GROUP_BY("ap")},
               ap.citizenship_status, psa.granted_at
      ORDER BY psa.granted_at DESC
    `,
    [swUserId],
  )

  return result.rows.map((row) => ({
    access_id: row.access_id,
    patient_user_id: row.patient_user_id,
    email: row.email,
    first_name:        decryptOrPlain(row.first_name_encrypted,  row.first_name),
    last_name:         decryptOrPlain(row.last_name_encrypted,   row.last_name),
    dob:               decryptOrPlain(row.dob_encrypted,         row.dob),
    phone:             decryptOrPlain(row.phone_encrypted,       row.phone),
    city:              decryptOrPlain(row.city_encrypted,        row.city),
    state:             decryptOrPlain(row.state_encrypted,       row.state),
    zip:               decryptOrPlain(row.zip_encrypted,         row.zip),
    citizenship_status:    row.citizenship_status,
    granted_at:            row.granted_at,
    application_count:     row.application_count,
    latest_application_status: row.latest_application_status,
  }))
}

export async function getPatientApplications(
  patientUserId: string,
  swUserId: string,
): Promise<SwApplicationSummary[]> {
  const pool = getDbPool()

  // Verify SW has active access to this patient
  const accessCheck = await pool.query<{ has_access: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.patient_social_worker_access
        WHERE patient_user_id = $1::uuid
          AND social_worker_user_id = $2::uuid
          AND is_active = true
      ) AS has_access
    `,
    [patientUserId, swUserId],
  )

  if (!accessCheck.rows[0]?.has_access) {
    return []
  }

  // applicant_name is built in app code after decryption — SQL CONCAT on
  // ciphertext would produce garbage.  We select dual columns (encrypted +
  // plaintext fallback) and assemble the display name here.
  const result = await pool.query<{
    id: string
    status: string
    application_type: string | null
    draft_step: number | null
    household_size: number | null
    total_monthly_income: number | null
    first_name_encrypted: string | null
    first_name: string | null
    last_name_encrypted: string | null
    last_name: string | null
    created_at: string
    updated_at: string
    submitted_at: string | null
  }>(
    `
      SELECT
        a.id, a.status, a.application_type, a.draft_step,
        a.household_size, a.total_monthly_income,
        ap.first_name_encrypted, ap.first_name,
        ap.last_name_encrypted,  ap.last_name,
        a.created_at, a.updated_at, a.submitted_at
      FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE ap.user_id = $1::uuid
      ORDER BY a.created_at DESC
    `,
    [patientUserId],
  )

  return result.rows.map((row) => ({
    id:                   row.id,
    status:               row.status,
    application_type:     row.application_type,
    draft_step:           row.draft_step,
    household_size:       row.household_size,
    total_monthly_income: row.total_monthly_income,
    applicant_name:       decryptDisplayName(
      row.first_name_encrypted, row.first_name,
      row.last_name_encrypted,  row.last_name,
    ),
    created_at:   row.created_at,
    updated_at:   row.updated_at,
    submitted_at: row.submitted_at,
  }))
}

export type SwSearchResult = {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company_name: string
}

/**
 * Search approved social workers by name, email, or company name.
 * Pass an empty query to return all approved SWs (up to 20).
 */
export async function searchApprovedSocialWorkers(query: string): Promise<SwSearchResult[]> {
  const pool = getDbPool()

  if (!query.trim()) {
    // Return all approved SWs when query is empty
    const result = await pool.query<SwSearchResult>(
      `
        SELECT
          u.id AS user_id,
          u.email,
          swp.first_name,
          swp.last_name,
          c.name AS company_name
        FROM public.users u
        JOIN public.social_worker_profiles swp ON swp.user_id = u.id
        JOIN public.companies c ON c.id = swp.company_id
        WHERE swp.status = 'approved'
        ORDER BY c.name, swp.last_name NULLS LAST
        LIMIT 20
      `,
    )
    return result.rows
  }

  const like = `%${query}%`
  const result = await pool.query<SwSearchResult>(
    `
      SELECT
        u.id AS user_id,
        u.email,
        swp.first_name,
        swp.last_name,
        c.name AS company_name
      FROM public.users u
      JOIN public.social_worker_profiles swp ON swp.user_id = u.id
      JOIN public.companies c ON c.id = swp.company_id
      WHERE swp.status = 'approved'
        AND (
          u.email ILIKE $1
          OR swp.first_name ILIKE $1
          OR swp.last_name ILIKE $1
          OR CONCAT(swp.first_name, ' ', swp.last_name) ILIKE $1
          OR c.name ILIKE $1
        )
      ORDER BY c.name, swp.last_name NULLS LAST
      LIMIT 20
    `,
    [like],
  )
  return result.rows
}

export async function grantSocialWorkerAccess(
  patientUserId: string,
  swUserId: string,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `
      INSERT INTO public.patient_social_worker_access
        (patient_user_id, social_worker_user_id, granted_at, is_active)
      VALUES ($1::uuid, $2::uuid, now(), true)
      ON CONFLICT (patient_user_id, social_worker_user_id)
      DO UPDATE SET is_active = true, revoked_at = NULL, granted_at = now()
    `,
    [patientUserId, swUserId],
  )
}

export async function revokeSocialWorkerAccess(
  patientUserId: string,
  swUserId: string,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `
      UPDATE public.patient_social_worker_access
      SET is_active = false, revoked_at = now()
      WHERE patient_user_id = $1::uuid
        AND social_worker_user_id = $2::uuid
    `,
    [patientUserId, swUserId],
  )
}

export async function getPatientSocialWorkers(
  patientUserId: string,
): Promise<
  Array<{
    access_id: string
    sw_user_id: string
    email: string
    first_name: string | null
    last_name: string | null
    company_name: string
    granted_at: string
  }>
> {
  const pool = getDbPool()
  const result = await pool.query(
    `
      SELECT
        psa.id AS access_id,
        u.id AS sw_user_id,
        u.email,
        swp.first_name,
        swp.last_name,
        c.name AS company_name,
        psa.granted_at
      FROM public.patient_social_worker_access psa
      JOIN public.users u ON u.id = psa.social_worker_user_id
      JOIN public.social_worker_profiles swp ON swp.user_id = u.id
      JOIN public.companies c ON c.id = swp.company_id
      WHERE psa.patient_user_id = $1::uuid
        AND psa.is_active = true
      ORDER BY psa.granted_at DESC
    `,
    [patientUserId],
  )
  return result.rows
}
