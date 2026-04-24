"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { AuthGuard } from "@/components/shared/AuthGuard"

export default function AppealAssistantLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard next="/appeal-assistant">{children}</AuthGuard>
}
