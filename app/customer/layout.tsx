"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/auth/login?next=/customer/dashboard")
      } else {
        setReady(true)
      }
    })
  }, [router])

  if (!ready) return null

  return <>{children}</>
}
