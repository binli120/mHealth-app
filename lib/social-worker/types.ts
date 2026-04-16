/**
 * Shared social worker types.
 * @author Bin Lee
 */

import type { ApplicationStatus } from "@/lib/application-status"

export interface SocialWorkerPatient {
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
  latest_application_status: ApplicationStatus | null
}

export type SocialWorkerPatientStatusFilter = "" | ApplicationStatus | "no_applications"
