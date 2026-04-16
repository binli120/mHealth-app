/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getMessage } from "@/lib/i18n/messages"
import { type SupportedLanguage } from "@/lib/i18n/languages"
import { type ApplicationStatus } from "@/lib/application-status"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { useAppSelector } from "@/lib/redux/hooks"
import { ShieldHeartIcon, UserBadgeIcon } from "@/lib/icons"
import type { PageProps, ApplicationDraftRecord, DraftApiResponse, TimelineEvent } from "./page.types"
import { formatDate, formatDateTime, readContactField, readHouseholdSize, readCurrentIncome, buildTimeline, getApplicationTypeLabel } from "./page.utils"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  FileText,
  Upload,
  Users,
} from "lucide-react"

export default function StatusDetailPage({ params }: PageProps) {
  const language = useAppSelector((state) => state.app.language)
  const { id } = use(params)
  const [record, setRecord] = useState<ApplicationDraftRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const statusConfig = useMemo<Record<ApplicationStatus, {
    label: string
    color: string
    icon: typeof FileText
  }>>(
    () => ({
      draft: { label: getMessage(language, "dashboardStatusDraft"), color: "bg-secondary text-secondary-foreground", icon: FileText },
      submitted: { label: getMessage(language, "dashboardStatusSubmitted"), color: "bg-primary/10 text-primary", icon: Clock },
      ai_extracted: { label: getMessage(language, "dashboardStatusAiExtracted"), color: "bg-accent/10 text-accent", icon: Clock },
      needs_review: { label: getMessage(language, "dashboardStatusNeedsReview"), color: "bg-accent/10 text-accent", icon: Clock },
      rfi_requested: { label: getMessage(language, "dashboardStatusRfiRequested"), color: "bg-warning/10 text-warning", icon: AlertCircle },
      approved: { label: getMessage(language, "dashboardStatusApproved"), color: "bg-success/10 text-success", icon: CheckCircle2 },
      denied: { label: getMessage(language, "dashboardStatusDenied"), color: "bg-destructive/10 text-destructive", icon: AlertCircle },
    }),
    [language],
  )

  const loadRecord = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await authenticatedFetch(`/api/applications/${id}/draft`, {
        method: "GET",
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => ({}))) as DraftApiResponse

      if (!response.ok || !payload.ok || !payload.record) {
        throw new Error(payload.error || getMessage(language, "statusDetailNotFound"))
      }

      setRecord(payload.record)
    } catch (error) {
      setLoadError(toUserFacingError(error, getMessage(language, "statusDetailNotFound")))
      setRecord(null)
    } finally {
      setIsLoading(false)
    }
  }, [id, language])

  useEffect(() => {
    void loadRecord()
  }, [loadRecord])

  const timelineSteps = useMemo(() => buildTimeline(record, language), [language, record])
  const applicantName = useMemo(() => readContactField(record, "p1_name"), [record])
  const householdSize = useMemo(() => readHouseholdSize(record), [record])
  const monthlyIncome = useMemo(() => readCurrentIncome(record), [record])

  const status = record ? statusConfig[record.status] : statusConfig.draft
  const StatusIcon = status.icon
  const editHref = record ? `/application/new?applicationId=${record.id}` : "/application/type"

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            href="/customer/status"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{getMessage(language, "statusDetailBackToApplications")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">HealthCompass MA</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <Card className="border-border bg-card">
            <CardContent className="p-4 text-sm text-muted-foreground">
              {getMessage(language, "statusDetailLoading")}
            </CardContent>
          </Card>
        ) : loadError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadRecord()}>
                {getMessage(language, "statusListRetry")}
              </Button>
            </CardContent>
          </Card>
        ) : record ? (
          <>
            <div className="mb-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">
                      {getApplicationTypeLabel(record.applicationType, language)}
                    </h1>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${status.color}`}
                    >
                      <StatusIcon className="mr-1.5 h-4 w-4" />
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-muted-foreground">{record.id}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={editHref}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Edit3 className="h-4 w-4" />
                      {record.status === "draft" ? getMessage(language, "statusDetailContinueDraft") : getMessage(language, "statusDetailEdit")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">{getMessage(language, "statusDetailTimelineTitle")}</CardTitle>
                    <CardDescription>{getMessage(language, "statusDetailTimelineDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      {timelineSteps.map((step, index) => (
                        <div key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
                          {index < timelineSteps.length - 1 ? (
                            <div
                              className={`absolute left-[15px] top-8 h-full w-0.5 ${
                                step.state === "completed" ? "bg-success" : "bg-border"
                              }`}
                            />
                          ) : null}

                          <div
                            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              step.state === "completed"
                                ? "bg-success text-success-foreground"
                                : step.state === "current"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {step.state === "completed" ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : step.state === "current" ? (
                              <Clock className="h-5 w-5" />
                            ) : (
                              <div className="h-2 w-2 rounded-full bg-current" />
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                              <h4
                                className={`font-medium ${
                                  step.state === "pending" ? "text-muted-foreground" : "text-foreground"
                                }`}
                              >
                                {step.title}
                              </h4>
                              <span className="text-sm text-muted-foreground">{step.date}</span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {record.status === "rfi_requested" ? (
                  <Card className="border-warning/50 bg-warning/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-card-foreground">
                        <AlertCircle className="h-5 w-5 text-warning" />
                        {getMessage(language, "statusDetailAdditionalInfoTitle")}
                      </CardTitle>
                      <CardDescription>
                        {getMessage(language, "statusDetailAdditionalInfoDesc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={editHref}>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Upload className="h-4 w-4" />
                          {getMessage(language, "statusDetailOpenApplication")}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : null}
              </div>

              <div className="space-y-6">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-card-foreground">
                      {getMessage(language, "statusDetailSummaryTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <UserBadgeIcon color="currentColor" className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{getMessage(language, "statusDetailApplicant")}</p>
                        <p className="text-sm font-medium text-foreground">
                          {applicantName || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                        <Users className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{getMessage(language, "statusDetailHouseholdSize")}</p>
                        <p className="text-sm font-medium text-foreground">
                          {householdSize ? `${householdSize} member${householdSize > 1 ? "s" : ""}` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                        <DollarSign className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{getMessage(language, "statusDetailIncomeCurrentYear")}</p>
                        <p className="text-sm font-medium text-foreground">{monthlyIncome}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
                        <Calendar className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{getMessage(language, "statusDetailLastSaved")}</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatDate(record.lastSavedAt ?? record.updatedAt, language)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-card-foreground">{getMessage(language, "statusDetailDatesTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>{getMessage(language, "statusDetailCreated")}: {formatDate(record.createdAt, language)}</p>
                    <p>{getMessage(language, "statusListSubmitted")}: {formatDate(record.submittedAt, language)}</p>
                    <p>{getMessage(language, "statusDetailDraftStep")}: {record.draftStep ?? "—"}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
