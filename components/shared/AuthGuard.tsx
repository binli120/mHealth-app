"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSafeSupabaseSession } from "@/lib/supabase/client"
import { IdleTimeoutGuard } from "@/components/shared/IdleTimeoutGuard"

interface AuthGuardProps {
  children: React.ReactNode
  /** Where to redirect after login. Defaults to "/customer/dashboard". */
  next?: string
  /** Disable idle-timeout enforcement for exceptional authenticated surfaces. */
  idleTimeout?: boolean
}

/**
 * Blocks rendering until a valid Supabase session is confirmed.
 * Unauthenticated visitors are redirected to the login page.
 */
export function AuthGuard({ children, next = "/customer/dashboard", idleTimeout = true }: AuthGuardProps) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getSafeSupabaseSession()
      .then(({ session }) => {
        if (!session) {
          router.replace(`/auth/login?next=${encodeURIComponent(next)}`)
        } else {
          setReady(true)
        }
      })
      .catch(() => {
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`)
      })
  }, [router, next])

  if (!ready) return null

  return (
    <>
      {idleTimeout ? <IdleTimeoutGuard /> : null}
      {children}
    </>
  )
}
