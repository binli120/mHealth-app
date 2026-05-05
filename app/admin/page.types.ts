/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * TypeScript types for the Admin Dashboard page.
 * @author: Bin Lee
 */

export interface Stats {
  totalUsers: number
  pendingSwApprovals: number
  totalCompanies: number
  pendingCompanies: number
}

export interface QuickActionProps {
  href: string
  label: string
}
