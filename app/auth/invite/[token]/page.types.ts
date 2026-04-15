/**
 * TypeScript types for the Accept Invite page.
 * @author Bin Lee
 */

export interface InvitationInfo {
  email: string
  company_id: string | null
  company_name: string | null
  role: string
  expires_at: string
}

export type InvitePageState = "loading" | "ready" | "invalid" | "submitting" | "done"
