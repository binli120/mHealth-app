/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * TypeScript types for the Customer Status List page.
 * @author: Bin Lee
 */

import type { ApplicationStatus } from "@/lib/application-status"

export type {
  ApplicationListApiResponse,
  ApplicationListRecord,
} from "@/lib/applications/types"

export type StatusFilter = "all" | ApplicationStatus
