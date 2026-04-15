/**
 * TypeScript types for the Admin Dashboard page.
 * @author Bin Lee
 */

import type { ReactNode } from "react"

export interface Stats {
  totalUsers: number
  pendingSwApprovals: number
  totalCompanies: number
  pendingCompanies: number
}

export interface StatCardProps {
  label: string
  value: string
  icon: ReactNode
  href: string
  bg: string
  alert?: boolean
}

export interface QuickActionProps {
  href: string
  label: string
}
