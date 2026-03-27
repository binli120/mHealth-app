/**
 * TypeScript interfaces for the Admin Social Workers page.
 * @author Bin Lee
 */

export interface SocialWorker {
  id: string
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company_id: string
  company_name: string
  license_number: string | null
  job_title: string | null
  status: "pending" | "approved" | "rejected"
  rejection_note: string | null
  created_at: string
}

export interface CompanyOption {
  id: string
  name: string
  email_domain: string | null
}
