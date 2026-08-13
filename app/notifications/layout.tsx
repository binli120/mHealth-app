"use client"

/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { AuthGuard } from "@/components/shared/AuthGuard"

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard next="/notifications">{children}</AuthGuard>
}
