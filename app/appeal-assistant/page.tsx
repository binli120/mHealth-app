"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DenialInputForm } from "@/components/appeals/DenialInputForm"
import { AppealResultView } from "@/components/appeals/AppealResultView"
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
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/customer/dashboard"
              className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-900">Appeal Assistant</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Page intro — shown on form and loading states */}
        {(pageState === "form" || pageState === "loading") && (
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Scale className="h-6 w-6 text-red-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              Appeal Your MassHealth Denial
            </h1>
            <p className="mx-auto max-w-lg text-gray-500">
              Select your denial reason and we&apos;ll generate a personalized explanation, formal
              appeal letter, and evidence checklist — ready to submit.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {pageState === "loading" && (
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-28 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-52 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-36 animate-pulse rounded-lg bg-gray-200" />
          </div>
        )}

        {/* Form */}
        {pageState === "form" && (
          <DenialInputForm onSubmit={handleSubmit} isLoading={false} />
        )}

        {/* Error */}
        {pageState === "error" && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Analysis failed</p>
                <p className="mt-1 text-sm text-gray-600">{errorMessage}</p>
              </div>
              <Button variant="outline" onClick={() => setPageState("form")}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Result */}
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
