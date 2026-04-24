"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { AuthGuard } from "@/components/shared/AuthGuard"

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard next="/reviewer/dashboard">{children}</AuthGuard>
}
