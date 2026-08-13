/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import type { ReactNode } from 'react'
import { AuthGuard } from '@/components/shared/AuthGuard'

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <AuthGuard next="/help">{children}</AuthGuard>
}
