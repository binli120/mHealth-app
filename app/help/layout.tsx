/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import type { ReactNode } from 'react'
import { AuthGuard } from '@/components/shared/AuthGuard'

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <AuthGuard next="/help">{children}</AuthGuard>
}
