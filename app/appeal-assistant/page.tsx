/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

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
import { getAppealAssistantCopy } from "@/lib/appeals/copy"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { APPEAL_DENIAL_REASONS } from "@/lib/appeals/constants"
import type { AppealAnalysis, AppealRequest } from "@/lib/appeals/types"
import { useAppSelector } from "@/lib/redux/hooks"
import type { AppealApiErrorResponse, AppealApiResponse, PageState } from "./page.types"

export default function AppealAssistantPage() {
  const language = useAppSelector((state) => state.app.language)
  const copy = getAppealAssistantCopy(language)
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
        setErrorMessage(toUserFacingError(payload.error, { fallback: copy.serverError, context: "ai" }))
        setPageState("error")
        return
      }

      setAnalysis(payload.analysis)
      setPageState("result")
    } catch (error) {
      setErrorMessage(toUserFacingError(error, { fallback: copy.serverError, context: "ai" }))
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
        backLabel={copy.dashboard}
        breadcrumbs={[{ label: copy.appealAssistant }]}
        maxWidth="max-w-3xl"
      />

      <main className="mx-auto max-w-3xl px-4 py-8">
        {(pageState === "form" || pageState === "loading") && (
          <PageIntro
            icon={<Scale className="h-6 w-6 text-red-600" />}
            iconBg="bg-red-100"
            title={copy.pageTitle}
            description={copy.pageDescription}
          />
        )}

        {pageState === "loading" && (
          <LoadingSkeleton blocks={["h-6 w-48", "h-28", "h-52", "h-36"]} />
        )}

        {pageState === "form" && (
          <DenialInputForm onSubmit={handleSubmit} isLoading={false} language={language} />
        )}

        {pageState === "error" && (
          <ErrorCard
            title={copy.analysisFailed}
            message={errorMessage ?? copy.unexpectedError}
            onRetry={() => setPageState("form")}
            retryLabel={copy.retry}
          />
        )}

        {pageState === "result" && analysis && (
          <AppealResultView
            analysis={analysis}
            denialReasonLabel={selectedReasonLabel}
            onReset={handleReset}
            language={language}
          />
        )}
      </main>
    </div>
  )
}
