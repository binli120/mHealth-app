"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"

interface AuthGuardProps {
  children: React.ReactNode
  /** Where to redirect after login. Defaults to "/customer/dashboard". */
  next?: string
}

/**
 * Blocks rendering until a valid Supabase session is confirmed.
 * Unauthenticated visitors are redirected to the login page.
 */
export function AuthGuard({ children, next = "/customer/dashboard" }: AuthGuardProps) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!data.session) {
          router.replace(`/auth/login?next=${encodeURIComponent(next)}`)
        } else {
          setReady(true)
        }
      })
  }, [router, next])

  if (!ready) return null

  return <>{children}</>
}
