"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useCallback, useEffect, useState } from "react"
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
  const loginPath = `/auth/login?next=${encodeURIComponent(next)}`

  const verifySession = useCallback(() => {
    getSafeSupabaseSession()
      .then(({ session }) => {
        if (!session) {
          setReady(false)
          router.replace(loginPath)
        } else {
          setReady(true)
        }
      })
      .catch(() => {
        setReady(false)
        router.replace(loginPath)
      })
  }, [loginPath, router])

  useEffect(() => {
    verifySession()

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) verifySession()
    }
    const handleFocus = () => verifySession()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") verifySession()
    }

    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [verifySession])

  if (!ready) return null

  return (
    <>
      {idleTimeout ? <IdleTimeoutGuard /> : null}
      {children}
    </>
  )
}
