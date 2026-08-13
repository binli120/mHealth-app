"use client"

/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { AuthGuard } from "@/components/shared/AuthGuard"

export default function MassHealthAppealsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard next="/masshealth-appeals">{children}</AuthGuard>
}
