"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAsyncData } from "@/hooks/use-async-data"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import { type ApplicationStatus } from "@/lib/application-status"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { useAppSelector } from "@/lib/redux/hooks"
import { getMessage } from "@/lib/i18n/messages"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import {
  AlertCircle,
  Bell,
  BookOpenText,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  LogOut,
  Scale,
  Upload,
} from "lucide-react"
import { getSafeSupabaseUser } from "@/lib/supabase/client"
import { ShieldHeartIcon } from "@/lib/icons"
import { UserAvatar } from "@/components/shared/UserAvatar"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { IdleTimeoutGuard } from "@/components/shared/IdleTimeoutGuard"
import { formatDate } from "@/lib/utils/format"

type DashboardStatus = ApplicationStatus

interface ApplicationListRecord {
  id: string
  status: DashboardStatus
  applicationType: string | null
  draftStep: number | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  applicantName: string | null
  householdSize: number | null
}

interface ApplicationListApiResponse {
  ok: boolean
  records?: ApplicationListRecord[]
  total?: number
  error?: string
}

const STATUS_META: Record<DashboardStatus, { color: string; icon: typeof FileText }> = {
  draft: { color: "bg-secondary text-secondary-foreground", icon: FileText },
  submitted: { color: "bg-primary/10 text-primary", icon: Clock },
  ai_extracted: { color: "bg-accent/10 text-accent", icon: Clock },
  needs_review: { color: "bg-accent/10 text-accent", icon: Clock },
  rfi_requested: { color: "bg-warning/10 text-warning", icon: AlertCircle },
  approved: { color: "bg-success/10 text-success", icon: CheckCircle2 },
  denied: { color: "bg-destructive/10 text-destructive", icon: AlertCircle },
}

const APPLICATION_TYPE_LABELS = new Map<string, string>(
  MASSHEALTH_APPLICATION_TYPES.map((item) => [item.id, item.shortLabel]),
)

function getApplicationTypeLabel(type: string | null): string {
  if (!type) {
    return "Application"
  }

  return APPLICATION_TYPE_LABELS.get(type) ?? type.toUpperCase()
}

export default function CustomerDashboardPage() {
  const language = useAppSelector((state) => state.app.language)
  const userProfile = useAppSelector((state) => state.userProfile.profile)

  const [firstName, setFirstName] = useState("")

  const applicationsFetcher = useCallback(async () => {
    const response = await authenticatedFetch("/api/applications?limit=6", {
      method: "GET",
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => ({}))) as ApplicationListApiResponse
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Failed to load applications")
    return payload.records ?? []
  }, [])

  const { data: applicationsData, isLoading, error: loadError, reload: loadApplications } =
    useAsyncData(applicationsFetcher)
  const applications = useMemo(() => applicationsData ?? [], [applicationsData])

  // Translated status config, recomputed when language changes
  const statusConfig = useMemo(
    () => ({
      draft: { ...STATUS_META.draft, label: getMessage(language, "dashboardStatusDraft") },
      submitted: { ...STATUS_META.submitted, label: getMessage(language, "dashboardStatusSubmitted") },
      ai_extracted: { ...STATUS_META.ai_extracted, label: getMessage(language, "dashboardStatusAiExtracted") },
      needs_review: { ...STATUS_META.needs_review, label: getMessage(language, "dashboardStatusNeedsReview") },
      rfi_requested: { ...STATUS_META.rfi_requested, label: getMessage(language, "dashboardStatusRfiRequested") },
      approved: { ...STATUS_META.approved, label: getMessage(language, "dashboardStatusApproved") },
      denied: { ...STATUS_META.denied, label: getMessage(language, "dashboardStatusDenied") },
    }),
    [language],
  )

  useEffect(() => {
    let mounted = true

    const loadFirstName = async () => {
      const { user } = await getSafeSupabaseUser()
      const userMeta = user?.user_metadata as Record<string, unknown> | undefined
      const metadataFirstName = typeof userMeta?.first_name === "string" ? userMeta.first_name.trim() : ""

      if (mounted && metadataFirstName) {
        setFirstName(metadataFirstName)
      }
    }

    void loadFirstName()

    return () => {
      mounted = false
    }
  }, [])

  const needsActionApp = useMemo(
    () => applications.find((item) => item.status === "rfi_requested"),
    [applications],
  )

  const fallbackFirstName = useMemo(() => {
    const applicantName = applications.find((item) => item.applicantName)?.applicantName ?? ""
    const parsed = applicantName.trim().split(/\s+/).at(0) ?? ""
    return parsed || "Member"
  }, [applications])

  const greetingName = firstName || fallbackFirstName

  return (
    <div className="min-h-screen bg-background">
      <IdleTimeoutGuard />
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="whitespace-nowrap text-xl font-semibold text-foreground">HealthCompass MA</span>
          </div>
          <nav className="hidden min-w-0 shrink items-center gap-4 md:flex">
            <Link href="/customer/dashboard" className="shrink-0 whitespace-nowrap text-sm font-medium text-foreground">
              {getMessage(language, "dashboardNav")}
            </Link>
            <Link
              href="/customer/status"
              className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {getMessage(language, "dashboardNavApplications")}
            </Link>
            <Link
              href="/benefit-stack"
              className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {getMessage(language, "dashboardNavBenefitStack")}
            </Link>
            <Link
              href="/knowledge-center"
              className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {getMessage(language, "dashboardNavKnowledgeCenter")}
            </Link>
            <Link
              href="/appeal-assistant"
              className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {getMessage(language, "dashboardNavAppealAssistant")}
            </Link>
            <Link
              href="/customer/profile"
              className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              My Profile
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                {needsActionApp ? "1" : "0"}
              </span>
            </Button>
            <Link href="/customer/profile" aria-label="My Profile">
              <UserAvatar
                avatarUrl={userProfile?.avatarUrl}
                firstName={userProfile?.firstName ?? firstName}
                lastName={userProfile?.lastName}
                size="sm"
                className="cursor-pointer ring-2 ring-transparent transition-all hover:ring-primary/40"
              />
            </Link>
            <Link href="/">
              <Button variant="ghost" size="icon">
                <LogOut className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            {`${getMessage(language, "dashboardWelcomeBack")}, ${greetingName}`}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {getMessage(language, "dashboardSubtitle")}
          </p>
        </div>

        {/* Row 1: primary actions */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/application/type">
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">{getMessage(language, "dashboardNewApp")}</p>
                  <p className="text-sm text-muted-foreground">{getMessage(language, "dashboardNewAppDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/benefit-stack">
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <span className="text-xl">🏛️</span>
                </div>
                <div>
                  <p className="font-medium text-card-foreground">{getMessage(language, "dashboardNavBenefitStack")}</p>
                  <p className="text-sm text-muted-foreground">{getMessage(language, "dashboardBenefitStackDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/appeal-assistant">
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <Scale className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">{getMessage(language, "dashboardAppealAssistant")}</p>
                  <p className="text-sm text-muted-foreground">{getMessage(language, "dashboardAppealAssistantDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                <Upload className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">{getMessage(language, "dashboardUploadDocs")}</p>
                <p className="text-sm text-muted-foreground">{getMessage(language, "dashboardUploadDocsDesc")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: secondary actions */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/customer/status">
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <Clock className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">{getMessage(language, "dashboardTrackStatus")}</p>
                  <p className="text-sm text-muted-foreground">{getMessage(language, "dashboardTrackStatusDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/knowledge-center">
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                  <BookOpenText className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">{getMessage(language, "dashboardNavKnowledgeCenter")}</p>
                  <p className="text-sm text-muted-foreground">{getMessage(language, "dashboardKnowledgeCenterDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-card-foreground">{getMessage(language, "dashboardMyApplicationsTitle")}</CardTitle>
                    <CardDescription>{getMessage(language, "dashboardMyApplicationsDesc")}</CardDescription>
                  </div>
                  <Link href="/customer/status">
                    <Button variant="ghost" size="sm" className="gap-1">
                      {getMessage(language, "dashboardViewAll")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">{getMessage(language, "dashboardLoadingApps")}</p>
                ) : loadError ? (
                  <div className="space-y-3">
                    <p className="text-sm text-destructive">{loadError}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadApplications()}>
                      {getMessage(language, "dashboardRetry")}
                    </Button>
                  </div>
                ) : applications.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      {getMessage(language, "dashboardNoApps")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app) => {
                      const status = statusConfig[app.status]
                      const StatusIcon = status.icon
                      const itemHref =
                        app.status === "draft"
                          ? `/application/new?applicationId=${app.id}`
                          : `/customer/status/${app.id}`

                      return (
                        <Link key={app.id} href={itemHref}>
                          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50">
                            <div className="flex items-center gap-4">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg ${status.color}`}
                              >
                                <StatusIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {getApplicationTypeLabel(app.applicationType)}
                                </p>
                                <p className="text-sm text-muted-foreground">ID: {app.id}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
                              >
                                {status.label}
                              </span>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {getMessage(language, "dashboardUpdated")} {formatDate(app.lastSavedAt ?? app.updatedAt)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  {getMessage(language, "dashboardActionRequired")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {needsActionApp ? (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Application {needsActionApp.id} {getMessage(language, "dashboardActionRequiredDesc")}
                    </p>
                    <Link href={`/customer/status/${needsActionApp.id}`}>
                      <Button
                        size="sm"
                        className="w-full gap-2 bg-warning text-warning-foreground hover:bg-warning/90"
                      >
                        <Upload className="h-4 w-4" />
                        {getMessage(language, "dashboardReviewRequest")}
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {getMessage(language, "dashboardNoActionRequired")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <Calendar className="h-5 w-5 text-primary" />
                  {getMessage(language, "dashboardLatestActivity")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{getMessage(language, "dashboardNoActivity")}</p>
                ) : (
                  <div className="space-y-3">
                    {applications.slice(0, 2).map((app) => (
                        <div key={app.id} className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {app.draftStep ?? "*"}
                          </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {getApplicationTypeLabel(app.applicationType)} ({statusConfig[app.status].label})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(app.lastSavedAt ?? app.updatedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">{getMessage(language, "dashboardNeedHelp")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {getMessage(language, "dashboardSupportHours")}
                </p>
                <div className="text-sm">
                  <p className="font-medium text-foreground">1-800-841-2900</p>
                  <p className="text-muted-foreground">TTY: 1-800-497-4648</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
