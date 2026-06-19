/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Help Center | HealthCompass MA',
  description: 'Ask questions and get answers from the HealthCompass community and healthcare professionals.',
}

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
