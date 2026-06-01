/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAsyncData } from "@/hooks/use-async-data"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSafeSupabaseUser } from "@/lib/supabase/client"
import { InsuranceTimeline } from "@/components/insurance-history/insurance-timeline"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface RecordsApiResponse {
  ok: boolean
  records?: CoverageRecordWithExplanation[]
  error?: string
}

export default function InsuranceHistoryPage() {
  const router = useRouter()

  // Redirect to login if no valid session
  useEffect(() => {
    getSafeSupabaseUser().then(({ user }) => {
      if (!user) router.replace("/auth/login")
    })
  }, [router])

  const fetcher = useCallback(async () => {
    const res = await authenticatedFetch("/api/insurance-history/records-with-explanations", {
      method: "GET",
      cache: "no-store",
    })
    const payload = (await res.json().catch(() => ({}))) as RecordsApiResponse
    if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Failed to load insurance history")
    return payload.records ?? []
  }, [])

  const { data, isLoading, error } = useAsyncData<CoverageRecordWithExplanation[]>(fetcher)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Insurance History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your coverage history and why it changed each year.
        </p>
      </div>
      <InsuranceTimeline
        items={data ?? []}
        isLoading={isLoading}
        loadError={error}
      />
    </main>
  )
}
