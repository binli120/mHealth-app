/**
 * TypeScript types for the Mobile Verify page.
 * @author Bin Lee
 */

export type PageState =
  | "loading"
  | "expired"
  | "ready"
  | "scanning"
  | "processing"
  | "success"
  | "failed"

export interface ApiResponse {
  ok: boolean
  status?: "verified" | "needs_review" | "failed"
  score?: number
  extractedName?: string
  message?: string
  error?: string
}
