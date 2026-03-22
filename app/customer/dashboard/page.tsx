/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAsyncData } from "@/hooks/use-async-data"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import { MASSHEALTH_PHONE, MASSHEALTH_TTY_DIRECT } from "@/lib/masshealth/constants"
import { type ApplicationStatus } from "@/lib/application-status"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks"
import { setProfile } from "@/lib/redux/features/user-profile-slice"
import type { UserProfile } from "@/lib/user-profile/types"
import { getMessage } from "@/lib/i18n/messages"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import {
  AlertCircle,
  BookOpenText,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  LogOut,
  Scale,
  Upload,
  UserCheck,
  Plus,
  X,
  Loader2,
} from "lucide-react"
import { NotificationBell } from "@/components/notifications/NotificationBell"
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
  const dispatch = useAppDispatch()
  const language = useAppSelector((state) => state.app.language)
  const userProfile = useAppSelector((state) => state.userProfile.profile)

  const [firstName, setFirstName] = useState("")

  // Social worker access state
  const [socialWorkers, setSocialWorkers] = useState<Array<{
    access_id: string
    sw_user_id: string
    email: string
    first_name: string | null
    last_name: string | null
    company_name: string
    granted_at: string
  }>>([])
  const [swModalOpen, setSwModalOpen] = useState(false)
  const [swSearchEmail, setSwSearchEmail] = useState("")
  const [swSearchLoading, setSwSearchLoading] = useState(false)
  const [swSearchError, setSwSearchError] = useState("")
  const [swGranting, setSwGranting] = useState(false)

  // Fetch the user profile on mount if Redux doesn't already have it.
  // This ensures the navbar avatar always shows even when the user lands
  // on the dashboard directly (without visiting the profile page first).
  useEffect(() => {
    if (userProfile) return // already loaded — no need to fetch again

    let cancelled = false
    authenticatedFetch("/api/user-profile", { cache: "no-store" })
      .then((res) => res.json().catch(() => ({})))
      .then((payload: { ok?: boolean; profile?: UserProfile }) => {
        if (!cancelled && payload.ok && payload.profile) {
          dispatch(setProfile(payload.profile))
        }
      })
      .catch(() => {
        // Non-fatal — avatar simply won't show until the user visits the profile page
      })

    return () => {
      cancelled = true
    }
  }, [dispatch, userProfile])

  const loadSocialWorkers = useCallback(async () => {
    try {
      const res = await authenticatedFetch("/api/patient/social-worker-access", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (data.ok) setSocialWorkers(data.socialWorkers ?? [])
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => { void loadSocialWorkers() }, [loadSocialWorkers])

  const handleGrantAccess = async () => {
    if (!swSearchEmail.trim()) return
    setSwSearchLoading(true)
    setSwSearchError("")
    setSwGranting(true)
    try {
      const res = await authenticatedFetch("/api/patient/social-worker-access", {
        method: "POST",
        body: JSON.stringify({ socialWorkerEmail: swSearchEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!data.ok) {
        setSwSearchError(data.error ?? "Not found. Make sure the email belongs to an approved social worker.")
      } else {
        setSwModalOpen(false)
        setSwSearchEmail("")
        void loadSocialWorkers()
      }
    } catch {
      setSwSearchError("Failed to grant access.")
    } finally {
      setSwSearchLoading(false)
      setSwGranting(false)
    }
  }

  const handleRevokeAccess = async (swUserId: string) => {
    try {
      await authenticatedFetch("/api/patient/social-worker-access", {
        method: "DELETE",
        body: JSON.stringify({ socialWorkerId: swUserId }),
      })
      void loadSocialWorkers()
    } catch {
      // non-fatal
    }
  }

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
            <NotificationBell />
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
                  <p className="font-medium text-foreground">{MASSHEALTH_PHONE}</p>
                  <p className="text-muted-foreground">TTY: {MASSHEALTH_TTY_DIRECT}</p>
                </div>
              </CardContent>
            </Card>

            {/* Social Worker Access Panel */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Social Worker Access
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => { setSwModalOpen(true); setSwSearchError(""); setSwSearchEmail("") }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {socialWorkers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No social workers have access. You can add a social worker to help you with your applications.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {socialWorkers.map((sw) => (
                      <div key={sw.access_id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {[sw.first_name, sw.last_name].filter(Boolean).join(" ") || sw.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{sw.company_name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRevokeAccess(sw.sw_user_id)}
                          title="Revoke access"
                          className="text-muted-foreground hover:text-destructive flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Add Social Worker Modal */}
      {swModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card border border-border shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-card-foreground">Add Social Worker</h2>
              <button onClick={() => setSwModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Enter the email address of an approved social worker or case manager to grant them access to your applications.
            </p>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="socialworker@agency.org"
                value={swSearchEmail}
                onChange={(e) => { setSwSearchEmail(e.target.value); setSwSearchError("") }}
                onKeyDown={(e) => e.key === "Enter" && void handleGrantAccess()}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {swSearchError && <p className="text-xs text-destructive">{swSearchError}</p>}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSwModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-1.5"
                  disabled={swGranting || !swSearchEmail.trim()}
                  onClick={() => void handleGrantAccess()}
                >
                  {swSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Grant Access
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
