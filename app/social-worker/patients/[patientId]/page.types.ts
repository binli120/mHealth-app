/**
 * TypeScript types for the Social Worker Patient Dashboard page.
 * @author Bin Lee
 */

export type { ApplicationListRecord as ApplicationRecord } from "@/lib/applications/types"

export interface PatientInfo {
  email: string
  firstName: string | null
  lastName: string | null
  dob: string | null
  phone: string | null
  city: string | null
  state: string | null
}
