/**
 * GET /api/social-worker/patients/[patientId]/dashboard
 * Returns patient profile + applications in the same camelCase shape that
 * the customer dashboard expects, so the same UI can be reused.
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireApprovedSocialWorker } from "@/lib/auth/require-social-worker"
import { getDbPool } from "@/lib/db/server"
import { decryptOrPlain, decryptDisplayName } from "@/lib/db/applicant-fields"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const authResult = await requireApprovedSocialWorker(request)
  if (!authResult.ok) return authResult.response

  const { patientId } = await params
  const pool = getDbPool()

  // Verify active access
  const access = await pool.query<{ has_access: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.patient_social_worker_access
       WHERE patient_user_id = $1::uuid AND social_worker_user_id = $2::uuid AND is_active = true
     ) AS has_access`,
    [patientId, authResult.userId],
  )
  if (!access.rows[0]?.has_access) {
    return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 })
  }

  // Applications in the same shape as GET /api/applications
  const appsResult = await pool.query<{
    id: string
    status: string
    application_type: string | null
    draft_step: number | null
    last_saved_at: string | null
    submitted_at: string | null
    created_at: string
    updated_at: string
    first_name_encrypted: string | null
    last_name_encrypted: string | null
    household_size: number | null
  }>(
    `SELECT
       a.id,
       a.status,
       a.application_type,
       a.draft_step,
       a.last_saved_at,
       a.submitted_at,
       a.created_at,
       a.updated_at,
       ap.first_name_encrypted,
       ap.last_name_encrypted,
       a.household_size
     FROM public.applications a
     JOIN public.applicants ap ON ap.id = a.applicant_id
     WHERE ap.user_id = $1::uuid
     ORDER BY a.created_at DESC`,
    [patientId],
  )

  // Patient profile
  const profileResult = await pool.query<{
    email: string
    first_name_encrypted: string | null
    last_name_encrypted: string | null
    dob_encrypted: string | null
    phone_encrypted: string | null
    city_encrypted: string | null
    state_encrypted: string | null
  }>(
    `SELECT u.email,
            ap.first_name_encrypted, ap.last_name_encrypted,
            ap.dob_encrypted, ap.phone_encrypted,
            ap.city_encrypted, ap.state_encrypted
     FROM public.users u
     LEFT JOIN public.applicants ap ON ap.user_id = u.id
     WHERE u.id = $1::uuid
     LIMIT 1`,
    [patientId],
  )

  const p = profileResult.rows[0]
  const records = appsResult.rows.map((r) => ({
    id: r.id,
    status: r.status,
    applicationType: r.application_type,
    draftStep: r.draft_step,
    lastSavedAt: r.last_saved_at,
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    applicantName: decryptDisplayName(r.first_name_encrypted, r.last_name_encrypted),
    householdSize: r.household_size,
  }))

  return NextResponse.json({
    ok: true,
    records,
    total: records.length,
    patient: p
      ? {
          email: p.email,
          firstName: decryptOrPlain(p.first_name_encrypted),
          lastName: decryptOrPlain(p.last_name_encrypted),
          dob: decryptOrPlain(p.dob_encrypted),
          phone: decryptOrPlain(p.phone_encrypted),
          city: decryptOrPlain(p.city_encrypted),
          state: decryptOrPlain(p.state_encrypted),
        }
      : null,
  })
}
