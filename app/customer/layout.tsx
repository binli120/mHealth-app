"use client"

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { AuthGuard } from "@/components/shared/AuthGuard"

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard next="/customer/dashboard">{children}</AuthGuard>
}
