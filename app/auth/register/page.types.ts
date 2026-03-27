/**
 * TypeScript types for the Register page.
 * @author Bin Lee
 */

export type RegisterStep = "role-select" | "company-search" | "form" | "verify"
export type AccountRole = "applicant" | "social_worker"

export interface CompanyResult {
  id: string | null
  source: "nppes" | "local"
  name: string
  npi: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  email_domain: string | null
}

export interface DevRegisterResponse {
  ok?: boolean
  error?: string
}
