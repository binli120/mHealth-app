/**
 * TypeScript interfaces for the Admin Companies page.
 * @author Bin Lee
 */

export interface Company {
  id: string
  name: string
  npi: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email_domain: string | null
  status: "pending" | "approved" | "rejected"
  created_at: string
  approved_at: string | null
  sw_count: number
}

export interface NppesResult {
  id: string | null
  source: "nppes" | "local"
  name: string
  npi: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email_domain: string | null
}
