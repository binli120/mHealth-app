/**
 * TypeScript types for the Appeal Assistant page.
 * @author Bin Lee
 */

import type { AppealAnalysis } from "@/lib/appeals/types"

export type PageState = "form" | "loading" | "result" | "error"

export interface AppealApiResponse {
  ok: true
  analysis: AppealAnalysis
}

export interface AppealApiErrorResponse {
  ok: false
  error: string
}
