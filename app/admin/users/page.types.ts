/**
 * TypeScript interfaces for the Admin Users page.
 * @author Bin Lee
 */

export interface AdminUser {
  id: string
  email: string
  is_active: boolean
  created_at: string
  roles: string[]
  first_name: string | null
  last_name: string | null
  company_id: string | null
  company_name: string | null
}

export interface CompanyOption {
  id: string
  name: string
  email_domain: string | null
  status: string
}
