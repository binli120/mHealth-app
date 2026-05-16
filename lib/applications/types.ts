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
}

export interface ApplicationListApiResponse {
  ok: boolean
  records?: ApplicationListRecord[]
  total?: number
  error?: string
}
