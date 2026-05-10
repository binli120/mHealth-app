"use client"

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { AuthGuard } from "@/components/shared/AuthGuard"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

const REVIEWER_ROLES = new Set(["admin", "reviewer", "case_reviewer", "supervisor"])

interface AuthMeResponse {
  ok: boolean
  roles?: string[]
}

function ReviewerRoleGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false

    authenticatedFetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to verify reviewer role.")
        }

        const body = (await response.json()) as AuthMeResponse
        const roles = Array.isArray(body.roles) ? body.roles : []
        const hasReviewerRole = roles.some((role) => REVIEWER_ROLES.has(role))

        if (cancelled) return

        if (hasReviewerRole) {
          setAllowed(true)
          return
        }

        router.replace("/customer/dashboard")
      })
      .catch(() => {
        if (!cancelled) router.replace("/auth/login?next=/reviewer/dashboard")
      })

    return () => {
      cancelled = true
    }
  }, [router])

  if (!allowed) return null

  return <>{children}</>
}

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard next="/reviewer/dashboard">
      <ReviewerRoleGate>{children}</ReviewerRoleGate>
    </AuthGuard>
  )
}
