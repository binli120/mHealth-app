/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Shared application page contracts.
 * @author: Bin Lee
 */

import type { ApplicationStatus } from "@/lib/application-status"

export type ApplicationEntryMode = "chat" | "wizard"

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
  /** True when an encrypted PHI blob + server-stored key exist for this draft. */
  phiDraftLocked: boolean
  /** True when a social worker has modified this application and the customer has not yet confirmed. */
  needsCustomerReview: boolean
  /** ISO timestamp of the last SW-made save, or null if none. */
  swLastModifiedAt: string | null
}

export interface ApplicationListApiResponse {
  ok: boolean
  records?: ApplicationListRecord[]
  total?: number
  error?: string
}
