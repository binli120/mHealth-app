/**
 * TypeScript interfaces for the Customer Dashboard page.
 * @author Bin Lee
 */

import type { ApplicationStatus } from "@/lib/application-status"

export interface ApplicationListRecord {
  id: string
  status: ApplicationStatus
  applicationType: string | null
  draftStep: number | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  applicantName: string | null
  householdSize: number | null
}

export interface ApplicationListApiResponse {
  ok: boolean
  records?: ApplicationListRecord[]
  total?: number
  error?: string
}
