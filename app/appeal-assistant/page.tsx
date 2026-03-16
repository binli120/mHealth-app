"use client"

import { useState } from "react"
import { Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DenialInputForm } from "@/components/appeals/DenialInputForm"
import { AppealResultView } from "@/components/appeals/AppealResultView"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageIntro } from "@/components/shared/PageIntro"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import { ErrorCard } from "@/components/shared/ErrorCard"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { APPEAL_DENIAL_REASONS } from "@/lib/appeals/constants"
import type { AppealAnalysis, AppealRequest } from "@/lib/appeals/types"

type PageState = "form" | "loading" | "result" | "error"

interface AppealApiResponse {
  ok: true
  analysis: AppealAnalysis
}

interface AppealApiErrorResponse {
  ok: false
  error: string
}

export default function AppealAssistantPage() {
  const [pageState, setPageState] = useState<PageState>("form")
  const [analysis, setAnalysis] = useState<AppealAnalysis | null>(null)
  const [selectedReasonLabel, setSelectedReasonLabel] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(request: AppealRequest) {
    const reason = APPEAL_DENIAL_REASONS.find((r) => r.id === request.denialReasonId)
    setSelectedReasonLabel(reason?.label ?? "")
    setPageState("loading")
    setErrorMessage(null)

    try {
      const response = await authenticatedFetch("/api/appeals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      const payload = (await response.json()) as AppealApiResponse | AppealApiErrorResponse

      if (!payload.ok) {
        setErrorMessage(payload.error)
        setPageState("error")
        return
      }

      setAnalysis(payload.analysis)
      setPageState("result")
    } catch {
      setErrorMessage("Could not connect to the server. Please try again.")
      setPageState("error")
    }
  }

  function handleReset() {
    setPageState("form")
    setAnalysis(null)
    setErrorMessage(null)
    setSelectedReasonLabel("")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backHref="/customer/dashboard"
        backLabel="Dashboard"
        breadcrumbs={[{ label: "Appeal Assistant" }]}
        maxWidth="max-w-3xl"
      />

      <main className="mx-auto max-w-3xl px-4 py-8">
        {(pageState === "form" || pageState === "loading") && (
          <PageIntro
            icon={<Scale className="h-6 w-6 text-red-600" />}
            iconBg="bg-red-100"
            title="Appeal Your MassHealth Denial"
            description="Select your denial reason and we'll generate a personalized explanation, formal appeal letter, and evidence checklist — ready to submit."
          />
        )}

        {pageState === "loading" && (
          <LoadingSkeleton blocks={["h-6 w-48", "h-28", "h-52", "h-36"]} />
        )}

        {pageState === "form" && (
          <DenialInputForm onSubmit={handleSubmit} isLoading={false} />
        )}

        {pageState === "error" && (
          <ErrorCard
            title="Analysis failed"
            message={errorMessage ?? "An unexpected error occurred."}
            onRetry={() => setPageState("form")}
          />
        )}

        {pageState === "result" && analysis && (
          <AppealResultView
            analysis={analysis}
            denialReasonLabel={selectedReasonLabel}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}
