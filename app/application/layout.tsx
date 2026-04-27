"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { AuthGuard } from "@/components/shared/AuthGuard"
import { usePathname } from "next/navigation"

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === "/application/type") {
    return <>{children}</>
  }

  return <AuthGuard next="/customer/dashboard">{children}</AuthGuard>
}
