/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"

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
  const result = await pool.query<SwPatient>(
    `
      SELECT
        psa.id AS access_id,
        psa.patient_user_id,
        u.email,
        ap.first_name,
        ap.last_name,
        ap.dob,
        ap.phone,
        ap.city,
        ap.state,
        ap.zip,
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
               ap.first_name, ap.last_name, ap.dob, ap.phone,
               ap.city, ap.state, ap.zip, ap.citizenship_status, psa.granted_at
      ORDER BY psa.granted_at DESC
    `,
    [swUserId],
  )
  return result.rows
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

  const result = await pool.query<SwApplicationSummary>(
    `
      SELECT
        a.id, a.status, a.application_type, a.draft_step,
        a.household_size, a.total_monthly_income,
        CONCAT(ap.first_name, ' ', ap.last_name) AS applicant_name,
        a.created_at, a.updated_at, a.submitted_at
      FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE ap.user_id = $1::uuid
      ORDER BY a.created_at DESC
    `,
    [patientUserId],
  )
  return result.rows
}

export async function searchApprovedSocialWorkers(email: string): Promise<
  Array<{ user_id: string; email: string; first_name: string | null; last_name: string | null; company_name: string }>
> {
  const pool = getDbPool()
  const result = await pool.query(
    `
      SELECT
        u.id AS user_id,
        u.email,
        ap.first_name,
        ap.last_name,
        c.name AS company_name
      FROM public.users u
      JOIN public.social_worker_profiles swp ON swp.user_id = u.id
      JOIN public.companies c ON c.id = swp.company_id
      LEFT JOIN public.applicants ap ON ap.user_id = u.id
      WHERE swp.status = 'approved'
        AND u.email ILIKE $1
      LIMIT 10
    `,
    [`%${email}%`],
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
        ap.first_name,
        ap.last_name,
        c.name AS company_name,
        psa.granted_at
      FROM public.patient_social_worker_access psa
      JOIN public.users u ON u.id = psa.social_worker_user_id
      JOIN public.social_worker_profiles swp ON swp.user_id = u.id
      JOIN public.companies c ON c.id = swp.company_id
      LEFT JOIN public.applicants ap ON ap.user_id = u.id
      WHERE psa.patient_user_id = $1::uuid
        AND psa.is_active = true
      ORDER BY psa.granted_at DESC
    `,
    [patientUserId],
  )
  return result.rows
}
