"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import { type ApplicationStatus } from "@/lib/application-status"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { ShieldHeartIcon, UserBadgeIcon } from "@/lib/icons"
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

interface PageProps {
  params: Promise<{ id: string }>
}

interface ApplicationDraftRecord {
  id: string
  status: ApplicationStatus
  applicationType: string | null
  draftState: Record<string, unknown> | null
  draftStep: number | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

interface DraftApiResponse {
  ok: boolean
  record?: ApplicationDraftRecord
  error?: string
}

interface TimelineEvent {
  id: string
  title: string
  description: string
  date: string
  state: "completed" | "current" | "pending"
}

const statusConfig: Record<
  ApplicationStatus,
  {
    label: string
    color: string
    icon: typeof FileText
  }
> = {
  draft: { label: "Draft", color: "bg-secondary text-secondary-foreground", icon: FileText },
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary", icon: Clock },
  ai_extracted: { label: "AI Extracted", color: "bg-accent/10 text-accent", icon: Clock },
  needs_review: { label: "Under Review", color: "bg-accent/10 text-accent", icon: Clock },
  rfi_requested: { label: "Info Needed", color: "bg-warning/10 text-warning", icon: AlertCircle },
  approved: { label: "Approved", color: "bg-success/10 text-success", icon: CheckCircle2 },
  denied: { label: "Denied", color: "bg-destructive/10 text-destructive", icon: AlertCircle },
}

const APPLICATION_TYPE_LABELS = new Map<string, string>(
  MASSHEALTH_APPLICATION_TYPES.map((item) => [item.id, item.shortLabel]),
)

function formatDate(value: string | null): string {
  if (!value) {
    return "—"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function readContactField(record: ApplicationDraftRecord | null, key: string): string {
  const data = (record?.draftState?.data as Record<string, unknown> | undefined) ?? {}
  const contact = (data.contact as Record<string, unknown> | undefined) ?? {}
  const raw = contact[key]
  return typeof raw === "string" ? raw.trim() : ""
}

function readHouseholdSize(record: ApplicationDraftRecord | null): number | null {
  const value = readContactField(record, "p1_num_people")
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function readCurrentIncome(record: ApplicationDraftRecord | null): string {
  const data = (record?.draftState?.data as Record<string, unknown> | undefined) ?? {}
  const persons = (data.persons as Array<Record<string, unknown>> | undefined) ?? []
  const firstPerson = persons[0]
  if (!firstPerson) {
    return "—"
  }

  const incomeSection = (firstPerson.income as Record<string, unknown> | undefined) ?? {}
  const totalCurrentYear = incomeSection.total_income_current_year
  if (typeof totalCurrentYear === "string" && totalCurrentYear.trim()) {
    return totalCurrentYear
  }

  return "—"
}

function buildTimeline(record: ApplicationDraftRecord | null): TimelineEvent[] {
  if (!record) {
    return []
  }

  const events: TimelineEvent[] = [
    {
      id: "started",
      title: "Application Started",
      description: "Draft was created and can be resumed anytime.",
      date: formatDateTime(record.createdAt),
      state: "completed",
    },
  ]

  if (record.lastSavedAt) {
    events.push({
      id: "saved",
      title: "Draft Saved",
      description: `Progress saved up to step ${record.draftStep ?? "—"}.`,
      date: formatDateTime(record.lastSavedAt),
      state: record.status === "draft" ? "current" : "completed",
    })
  }

  if (record.submittedAt || record.status !== "draft") {
    events.push({
      id: "submitted",
      title: "Application Submitted",
      description: "Application submitted for review.",
      date: formatDateTime(record.submittedAt),
      state:
        record.status === "draft"
          ? "pending"
          : record.status === "submitted" ||
              record.status === "ai_extracted" ||
              record.status === "needs_review" ||
              record.status === "rfi_requested"
            ? "current"
            : "completed",
    })
  }

  events.push({
    id: "decision",
    title: "Decision",
    description: "Final determination by MassHealth.",
    date: record.status === "approved" || record.status === "denied" ? "Completed" : "Pending",
    state: record.status === "approved" || record.status === "denied" ? "completed" : "pending",
  })

  return events
}

function getApplicationTypeLabel(type: string | null): string {
  if (!type) {
    return "Application"
  }

  return APPLICATION_TYPE_LABELS.get(type) ?? type.toUpperCase()
}

export default function StatusDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const [record, setRecord] = useState<ApplicationDraftRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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
        throw new Error(payload.error || "Application was not found.")
      }

      setRecord(payload.record)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Application was not found.")
      setRecord(null)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadRecord()
  }, [loadRecord])

  const timelineSteps = useMemo(() => buildTimeline(record), [record])
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
            <span className="text-sm">Back to Applications</span>
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
              Loading application details...
            </CardContent>
          </Card>
        ) : loadError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadRecord()}>
                Retry
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
                      {getApplicationTypeLabel(record.applicationType)}
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
                      {record.status === "draft" ? "Continue Draft" : "Edit"}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">Application Timeline</CardTitle>
                    <CardDescription>Track your application progress</CardDescription>
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
                        Additional Information Requested
                      </CardTitle>
                      <CardDescription>
                        Please review your case and upload requested documents.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={editHref}>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Upload className="h-4 w-4" />
                          Open Application
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
                      Application Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <UserBadgeIcon color="currentColor" className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Applicant</p>
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
                        <p className="text-xs text-muted-foreground">Household Size</p>
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
                        <p className="text-xs text-muted-foreground">Income (Current Year)</p>
                        <p className="text-sm font-medium text-foreground">{monthlyIncome}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
                        <Calendar className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Saved</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatDate(record.lastSavedAt ?? record.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-card-foreground">Dates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Created: {formatDate(record.createdAt)}</p>
                    <p>Submitted: {formatDate(record.submittedAt)}</p>
                    <p>Draft Step: {record.draftStep ?? "—"}</p>
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
