/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react"
import { useAsyncData } from "@/hooks/use-async-data"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { type ApplicationStatus } from "@/lib/application-status"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { CUSTOMER_SUPPORT_EMAIL, CUSTOMER_SUPPORT_MAILTO } from "@/lib/support/contact"
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks"
import { resetProfile, setProfile } from "@/lib/redux/features/user-profile-slice"
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
  HelpCircle,
  Lock,
  LogOut,
  MessageCircle,
  Scale,
  FileSearch,
  Trash2,
  Upload,
  UserCheck,
  Plus,
  X,
  Loader2,
} from "lucide-react"
import { dispatchOpenSwChat } from "@/lib/events/chat-events"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { SessionInviteBanner } from "@/components/collaborative-sessions/SessionInviteBanner"
import { IdentityVerificationBanner } from "@/components/identity/IdentityVerificationBanner"
import { MfaBanner } from "@/components/security/MfaBanner"
import { getSafeSupabaseUser, signOutAndClearLocalAuth } from "@/lib/supabase/client"
import { ShieldHeartIcon } from "@/lib/icons"
import { UserAvatar } from "@/components/shared/UserAvatar"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { formatDate } from "@/lib/utils/format"
import { buildApplicationContinueHref } from "@/lib/applications/navigation"
import { Progress } from "@/components/ui/progress"
import type { ApplicationListApiResponse } from "./page.types"
import { STATUS_META } from "./page.constants"
import { buildDashboardGreeting, getApplicationTypeLabel } from "./page.utils"
import { DashboardTour } from "./dashboard-tour"
import { UploadToApplicationDialog } from "@/components/dashboard/UploadToApplicationDialog"
import { InsuranceSummaryCard } from "@/components/insurance-history/insurance-summary-card"

interface DashboardWidgetTooltipProps {
  children: ReactNode
  content: string
  side?: "top" | "right" | "bottom" | "left"
}

function DashboardWidgetTooltip({ children, content, side = "bottom" }: DashboardWidgetTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="max-w-xs text-left leading-5">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export default function CustomerDashboardPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const language = useAppSelector((state) => state.app.language)
  const userProfile = useAppSelector((state) => state.userProfile.profile)
  const unreadNotificationCount = useAppSelector((state) => state.notifications.unreadCount)

  const [firstName, setFirstName] = useState("")
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [dashboardTourRunId, setDashboardTourRunId] = useState(0)
  const [loginGreetingDate] = useState(() => new Date())

  // Social worker access state
  type SocialWorker = {
    access_id: string
    sw_user_id: string
    email: string
    first_name: string | null
    last_name: string | null
    company_name: string
    granted_at: string
  }
  const [socialWorkers, setSocialWorkers] = useReducer(
    (_prev: SocialWorker[], next: SocialWorker[]) => next,
    [],
  )
  const [swModalOpen, setSwModalOpen] = useState(false)
  const [swSearchEmail, setSwSearchEmail] = useState("")
  const [swSearchLoading, setSwSearchLoading] = useState(false)
  const [swSearchError, setSwSearchError] = useState("")
  const [swGranting, setSwGranting] = useState(false)
  const [swRevokeTarget, setSwRevokeTarget] = useState<{ swUserId: string; name: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

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
        setSwSearchError(toUserFacingError(data.error, {
          fallback: "Not found. Make sure the email belongs to an approved social worker.",
          context: "profile",
        }))
      } else {
        setSwModalOpen(false)
        setSwSearchEmail("")
        void loadSocialWorkers()
      }
    } catch (error) {
      setSwSearchError(toUserFacingError(error, "Failed to grant access."))
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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError("")
    try {
      const res = await authenticatedFetch(
        `/api/applications/${encodeURIComponent(deleteTarget.id)}/draft`,
        { method: "DELETE" },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setDeleteError(data.error || "Failed to delete application.")
        return
      }
      setDeleteTarget(null)
      void loadApplications()
    } catch {
      setDeleteError("Failed to delete application.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLogout = async () => {
    setIsSigningOut(true)

    try {
      await signOutAndClearLocalAuth()
    } finally {
      dispatch(resetProfile())
      router.replace("/")
      router.refresh()
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
  const dashboardGreeting = useMemo(
    () => buildDashboardGreeting({
      applications,
      greetingName,
      now: loginGreetingDate,
      unreadNotificationCount,
    }),
    [applications, greetingName, loginGreetingDate, unreadNotificationCount],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden whitespace-nowrap text-xl font-semibold text-foreground sm:inline">HealthCompass MA</span>
          </div>
          <nav className="hidden min-w-0 flex-1 items-center gap-3 overflow-hidden md:flex">
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
              href="/customer/sessions"
              className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sessions
            </Link>
            <Link
              href="/knowledge-center"
              className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {getMessage(language, "dashboardNavKnowledgeCenter")}
            </Link>
            <Link
              href="/masshealth-appeals"
              className="shrink-0 whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Appeal Letter
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2 sm:gap-3" data-tour="dashboard-account-tools">
              <span className="hidden sm:contents">
                <LanguageSwitcher />
              </span>
              <span className="hidden sm:contents">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      data-tour="dashboard-help"
                      onClick={() => setDashboardTourRunId((id) => id + 1)}
                      aria-label="Open dashboard tutorial"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    Open dashboard tutorial
                  </TooltipContent>
                </Tooltip>
              </span>
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void handleLogout()}
                disabled={isSigningOut}
                aria-label="Sign out"
              >
                {isSigningOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-normal text-foreground md:text-3xl">
              {dashboardGreeting.heading}
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {dashboardGreeting.message}
            </p>
          </div>
          {dashboardGreeting.cta && (
            <Button asChild className="w-full shrink-0 md:w-auto">
              <Link href={dashboardGreeting.cta.href}>
                {dashboardGreeting.cta.label}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        <SessionInviteBanner />

        {/* 2FA nudge — shown when user has no verified TOTP factor */}
        <MfaBanner className="mb-4" />

        {/* Identity verification soft nudge — hidden once verified */}
        <IdentityVerificationBanner className="mb-4" />

        {/* Dashboard actions */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <DashboardWidgetTooltip content="Start a new MassHealth application. You will choose the right form type, then complete it step by step.">
            <Link href="/application/type" data-tour="dashboard-new-application" className="h-full lg:col-span-4">
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
          </DashboardWidgetTooltip>
          <DashboardWidgetTooltip content="Screen your household for MassHealth and other support programs, including food, housing, childcare, and cash assistance.">
            <Link href="/benefit-stack" data-tour="dashboard-benefit-stack" className="h-full lg:col-span-4">
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
          </DashboardWidgetTooltip>
          <DashboardWidgetTooltip content="Research the denial reason and draft a MassHealth appeal letter using your case details and supporting documents.">
            <Link href="/masshealth-appeals" data-tour="dashboard-appeal-letter" className="h-full lg:col-span-4">
              <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50">
                    <FileSearch className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">Appeal Letter</p>
                    <p className="text-sm text-muted-foreground">Research &amp; draft a MassHealth appeal</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </DashboardWidgetTooltip>
          <DashboardWidgetTooltip content="Upload a filled-out MassHealth form (PDF or photo) and Compass will pre-fill your application from it.">
            <UploadToApplicationDialog>
              <div
                className="h-full lg:col-span-4"
                data-tour="dashboard-upload-documents"
              >
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
            </UploadToApplicationDialog>
          </DashboardWidgetTooltip>
          <DashboardWidgetTooltip content="Track draft and submitted applications, review status changes, and open any application that needs more work.">
            <Link href="/customer/status" data-tour="dashboard-track-status" className="h-full lg:col-span-4">
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
          </DashboardWidgetTooltip>
          <DashboardWidgetTooltip content="Open guides, articles, and videos that explain MassHealth rules, documents, renewals, and next steps.">
            <Link href="/knowledge-center" data-tour="dashboard-knowledge-center" className="h-full lg:col-span-4">
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
          </DashboardWidgetTooltip>
          <div className="h-full lg:col-span-4">
            <InsuranceSummaryCard latest={null} language={language} />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DashboardWidgetTooltip
              content="Review recent applications. Open drafts to continue editing, or open submitted applications to see status, notices, and history."
              side="right"
            >
              <Card className="border-border bg-card" data-tour="dashboard-applications">
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
                            ? buildApplicationContinueHref(app.id)
                            : `/customer/status/${app.id}`
                        // Wizard has 9 steps; use draftStep for a rough completion %.
                        const stepProgress = app.draftStep != null
                          ? Math.min(100, Math.round((app.draftStep / 9) * 100))
                          : null

                        const isDeletable = app.status !== "approved" && app.status !== "denied"

                        return (
                          <div key={app.id} className="relative group">
                            <Link href={itemHref} className="block">
                              <div className="rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${status.color}`}>
                                      <StatusIcon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-foreground">
                                        {getApplicationTypeLabel(app.applicationType)} Application
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Started {formatDate(app.createdAt)}
                                        {app.lastSavedAt ? ` · Saved ${formatDate(app.lastSavedAt)}` : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-2 pr-7">
                                    {app.phiDraftLocked && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700" title="Personal information saved securely">
                                        <Lock className="h-3 w-3" />
                                        Secured
                                      </span>
                                    )}
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                </div>
                                {stepProgress !== null && stepProgress > 0 && (
                                  <div className="mt-3 space-y-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>Wizard progress</span>
                                      <span>{stepProgress}%</span>
                                    </div>
                                    <Progress value={stepProgress} className="h-1.5" />
                                  </div>
                                )}
                              </div>
                            </Link>
                            {isDeletable && (
                              <button
                                type="button"
                                aria-label="Delete application"
                                onClick={() => setDeleteTarget({
                                  id: app.id,
                                  label: `${getApplicationTypeLabel(app.applicationType)} Application`,
                                })}
                                className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </DashboardWidgetTooltip>
          </div>

          <div className="space-y-6">
            <DashboardWidgetTooltip content="Shows urgent MassHealth requests, such as missing documents or information you need to review." side="left">
              <Card className="border-warning/50 bg-warning/5" data-tour="dashboard-action-required">
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
            </DashboardWidgetTooltip>

            <DashboardWidgetTooltip content="Summarizes the latest updates across your applications so you can see what changed recently." side="left">
              <Card className="border-border bg-card" data-tour="dashboard-activity">
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
            </DashboardWidgetTooltip>

            <DashboardWidgetTooltip content="Find HealthCompass support contact information." side="left">
              <Card className="border-border bg-card" data-tour="dashboard-support">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">{getMessage(language, "dashboardNeedHelp")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {getMessage(language, "dashboardSupportHours")}
                </p>
                <div className="text-sm">
                  <a href={CUSTOMER_SUPPORT_MAILTO} className="font-medium text-foreground hover:underline">
                    {CUSTOMER_SUPPORT_EMAIL}
                  </a>
                </div>
              </CardContent>
            </Card>
            </DashboardWidgetTooltip>

            {/* Social Worker Access Panel */}
            <DashboardWidgetTooltip content="Grant an approved social worker access to help review applications, respond to requests, and chat with you." side="left">
              <Card className="border-border bg-card" data-tour="dashboard-social-worker">
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
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => dispatchOpenSwChat(
                              sw.sw_user_id,
                              [sw.first_name, sw.last_name].filter(Boolean).join(" ") || sw.email,
                            )}
                            title="Chat with social worker"
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => setSwRevokeTarget({
                              swUserId: sw.sw_user_id,
                              name: [sw.first_name, sw.last_name].filter(Boolean).join(" ") || sw.email,
                            })}
                            title="Revoke access"
                            className="text-muted-foreground hover:text-destructive p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </DashboardWidgetTooltip>
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

      {/* Revoke SW access confirmation */}
      <AlertDialog open={!!swRevokeTarget} onOpenChange={(o) => { if (!o) setSwRevokeTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove social worker access?</AlertDialogTitle>
            <AlertDialogDescription>
              {swRevokeTarget?.name
                ? <><strong>{swRevokeTarget.name}</strong> will no longer be able to view or assist with your applications.</>
                : "This social worker will no longer be able to view or assist with your applications."
              }
              {" "}You can re-add them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSwRevokeTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (swRevokeTarget) void handleRevokeAccess(swRevokeTarget.swUserId)
                setSwRevokeTarget(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !isDeleting) { setDeleteTarget(null); setDeleteError("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  This will permanently delete your <strong>{deleteTarget.label}</strong> and all saved progress. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive px-1">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => { setDeleteTarget(null); setDeleteError("") }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => void handleDeleteConfirm()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DashboardTour runId={dashboardTourRunId} />
    </div>
  )
}
