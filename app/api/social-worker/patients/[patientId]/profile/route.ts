/**
 * GET /api/social-worker/patients/[patientId]/profile
 * Returns the patient's profile and care team for a social worker who has active access.
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { requireApprovedSocialWorker } from "@/lib/auth/require-social-worker"
import { getDbPool } from "@/lib/db/server"
import { decryptOrPlain } from "@/lib/db/applicant-fields"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const authResult = await requireApprovedSocialWorker(request)
  if (!authResult.ok) return authResult.response

  const { patientId } = await params
  const pool = getDbPool()

  // Verify this SW has active access
  const accessCheck = await pool.query<{ has_access: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.patient_social_worker_access
       WHERE patient_user_id = $1::uuid
         AND social_worker_user_id = $2::uuid
         AND is_active = true
     ) AS has_access`,
    [patientId, authResult.userId],
  )
  if (!accessCheck.rows[0]?.has_access) {
    return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 })
  }

  // Fetch full patient profile
  const profileResult = await pool.query<{
    patient_user_id: string
    email: string
    first_name_encrypted: string | null
    last_name_encrypted: string | null
    dob_encrypted: string | null
    phone_encrypted: string | null
    address_line1_encrypted: string | null
    city_encrypted: string | null
    state_encrypted: string | null
    zip_encrypted: string | null
    granted_at: string
  }>(
    `
      SELECT
        psa.patient_user_id,
        u.email,
        ap.first_name_encrypted, ap.last_name_encrypted,
        ap.dob_encrypted, ap.phone_encrypted,
        ap.address_line1_encrypted, ap.city_encrypted,
        ap.state_encrypted, ap.zip_encrypted,
        psa.granted_at
      FROM public.patient_social_worker_access psa
      JOIN public.users u ON u.id = psa.patient_user_id
      LEFT JOIN public.applicants ap ON ap.user_id = psa.patient_user_id
      WHERE psa.patient_user_id = $1::uuid
        AND psa.social_worker_user_id = $2::uuid
        AND psa.is_active = true
      LIMIT 1
    `,
    [patientId, authResult.userId],
  )

  // Fetch full care team (all SWs with active access to this patient)
  const careTeamResult = await pool.query<{
    sw_user_id: string
    email: string
    first_name: string | null
    last_name: string | null
    company_name: string
    granted_at: string
  }>(
    `
      SELECT
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
      ORDER BY psa.granted_at ASC
    `,
    [patientId],
  )

  const p = profileResult.rows[0]
  return NextResponse.json({
    ok: true,
    patient: p
      ? {
          patient_user_id: p.patient_user_id,
          email: p.email,
          first_name:   decryptOrPlain(p.first_name_encrypted),
          last_name:    decryptOrPlain(p.last_name_encrypted),
          dob:          decryptOrPlain(p.dob_encrypted),
          phone:        decryptOrPlain(p.phone_encrypted),
          address_line1: decryptOrPlain(p.address_line1_encrypted),
          city:         decryptOrPlain(p.city_encrypted),
          state:        decryptOrPlain(p.state_encrypted),
          zip:          decryptOrPlain(p.zip_encrypted),
          citizenship_status: null,
          granted_at:   p.granted_at,
        }
      : null,
    careTeam: careTeamResult.rows,
  })
}
