"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { AuthGuard } from "@/components/shared/AuthGuard"

export default function BenefitStackLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard next="/benefit-stack">{children}</AuthGuard>
}
