/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useAsyncData } from "@/hooks/use-async-data"
import { useAppSelector } from "@/lib/redux/hooks"
import { getMessage } from "@/lib/i18n/messages"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { ShieldHeartIcon } from "@/lib/icons"
import { InsuranceTimeline } from "@/components/insurance-history/insurance-timeline"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface RecordsApiResponse {
  ok: boolean
  records?: CoverageRecordWithExplanation[]
  error?: string
}

export default function InsuranceHistoryPage() {
  const language = useAppSelector((state) => state.app.language)

  const fetcher = useCallback(async () => {
    const res = await authenticatedFetch("/api/insurance-history/records-with-explanations", {
      method: "GET",
      cache: "no-store",
    })
    const payload = (await res.json().catch(() => ({}))) as RecordsApiResponse
    if (!res.ok || !payload.ok) throw new Error(payload.error ?? getMessage(language, "insuranceHistoryError"))
    return payload.records ?? []
  }, [language])

  const { data, isLoading, error } = useAsyncData<CoverageRecordWithExplanation[]>(fetcher)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            href="/customer/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{getMessage(language, "insuranceHistoryBackToDashboard")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">HealthCompass MA</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:w-2/3">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            {getMessage(language, "insuranceHistoryTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {getMessage(language, "insuranceHistorySubtitle")}
          </p>
        </div>
        <InsuranceTimeline
          items={data ?? []}
          isLoading={isLoading}
          loadError={error}
          language={language}
        />
      </main>
    </div>
  )
}
