/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback } from "react"
import { useAsyncData } from "@/hooks/use-async-data"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { InsuranceTimeline } from "@/components/insurance-history/insurance-timeline"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface RecordsApiResponse {
  ok: boolean
  records?: CoverageRecordWithExplanation[]
  error?: string
}

export default function InsuranceHistoryPage() {
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
      {isLoading && (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 border rounded-lg p-4 space-y-2">
                <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {!isLoading && !error && (
        <InsuranceTimeline items={data ?? []} />
      )}
    </main>
  )
}
