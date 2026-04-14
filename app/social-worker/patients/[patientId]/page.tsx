"use client"

/**
 * Social worker view of a patient — renders the exact same dashboard
 * experience the patient sees, in read-only mode.
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import { MASSHEALTH_PHONE, MASSHEALTH_TTY_DIRECT } from "@/lib/masshealth/constants"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { formatDate } from "@/lib/utils/format"
import {
  AlertCircle,
  ArrowLeft,
  BookOpenText,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Scale,
  Upload,
  UserCheck,
  X,
} from "lucide-react"

// ── Types (same shape as customer dashboard) ─────────────────────────────────
interface ApplicationRecord {
  id: string
  status: string
  applicationType: string | null
  draftStep: number | null
  lastSavedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  applicantName: string | null
  householdSize: number | null
}

interface PatientInfo {
  email: string
  firstName: string | null
  lastName: string | null
  dob: string | null
  phone: string | null
  city: string | null
  state: string | null
}

// ── Status config (mirrors customer dashboard) ────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  draft:        { label: "In Progress",       color: "bg-secondary text-secondary-foreground", icon: FileText },
  submitted:    { label: "Submitted",          color: "bg-primary/10 text-primary",             icon: Clock },
  ai_extracted: { label: "AI Extracted",       color: "bg-accent/10 text-accent",               icon: Clock },
  needs_review: { label: "Needs Review",       color: "bg-accent/10 text-accent",               icon: Clock },
  rfi_requested:{ label: "Info Requested",     color: "bg-warning/10 text-warning",             icon: AlertCircle },
  approved:     { label: "Approved",           color: "bg-success/10 text-success",             icon: CheckCircle2 },
  denied:       { label: "Denied",             color: "bg-destructive/10 text-destructive",     icon: AlertCircle },
}

const APPLICATION_TYPE_LABELS = new Map<string, string>(
  MASSHEALTH_APPLICATION_TYPES.map((item) => [item.id, item.shortLabel]),
)
function getApplicationTypeLabel(type: string | null) {
  if (!type) return "Application"
  return APPLICATION_TYPE_LABELS.get(type) ?? type.toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SWPatientDashboardPage() {
  const params = useParams()
  const patientId = params.patientId as string

  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`/api/social-worker/patients/${patientId}/dashboard`)
      const data = await res.json()
      if (!data.ok) { setError(data.error ?? "Access denied"); return }
      setApplications(data.records ?? [])
      setPatient(data.patient ?? null)
    } catch {
      setError("Failed to load patient data.")
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { void loadData() }, [loadData])

  const needsActionApp = useMemo(
    () => applications.find((a) => a.status === "rfi_requested"),
    [applications],
  )

  const patientName = patient
    ? [patient.firstName, patient.lastName].filter(Boolean).join(" ") || patient.email
    : "Patient"

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Link href="/social-worker/patients" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Patients
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">

      {/* ── SW context banner ── */}
      <div className="sticky top-0 z-50 border-b border-blue-200 bg-blue-50 px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Link
            href="/social-worker/patients"
            className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            My Patients
          </Link>
          <span className="text-blue-300 text-xs">·</span>
          <span className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" />
            Viewing dashboard as <strong>{patientName}</strong>
            {patient?.city && (
              <span className="font-normal text-blue-500">· {patient.city}{patient.state ? `, ${patient.state}` : ""}</span>
            )}
          </span>
          <span className="ml-auto text-xs text-blue-500 italic">Read-only view</span>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Welcome Back, {patient?.firstName ?? patientName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your MassHealth and benefits applications
          </p>
        </div>

        {/* Row 1: primary action cards (read-only) */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* New application — SW can create on behalf of patient */}
          <Link href={`/social-worker/patients/${patientId}/applications/new`}>
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">New Application</p>
                  <p className="text-sm text-muted-foreground">Start an application for this patient</p>
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
                  <p className="font-medium text-card-foreground">Benefit Stack</p>
                  <p className="text-sm text-muted-foreground">Check all eligible programs</p>
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
                  <p className="font-medium text-card-foreground">Appeal Assistant</p>
                  <p className="text-sm text-muted-foreground">Help with denied applications</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Upload docs — disabled for SW */}
          <Card className="h-full border-border bg-card opacity-50 cursor-not-allowed">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                <Upload className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">Upload Documents</p>
                <p className="text-sm text-muted-foreground">Add supporting documents</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: secondary action cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/customer/status">
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <Clock className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">Track Status</p>
                  <p className="text-sm text-muted-foreground">Check application status</p>
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
                  <p className="font-medium text-card-foreground">Knowledge Center</p>
                  <p className="text-sm text-muted-foreground">Resources and guides</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Main content grid */}
        <div className="grid gap-8 lg:grid-cols-3">

          {/* Left: applications list */}
          <div className="lg:col-span-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-card-foreground">Applications</CardTitle>
                    <CardDescription>Recent applications for {patientName}</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => void loadData()}>
                    Refresh
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {applications.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      No applications yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map((app) => {
                      const meta = STATUS_META[app.status] ?? STATUS_META.draft
                      const StatusIcon = meta.icon
                      // Draft → open the form wizard on behalf of the patient
                      // Other statuses → view the status page
                      const href = app.status === "draft"
                        ? `/social-worker/patients/${patientId}/applications/${app.id}`
                        : `/customer/status/${app.id}`
                      return (
                        <Link
                          key={app.id}
                          href={href}
                          className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.color}`}>
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
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
                              {meta.label}
                            </span>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Updated {formatDate(app.lastSavedAt ?? app.updatedAt)}
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">

            {/* Action required */}
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  Action Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                {needsActionApp ? (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Application {needsActionApp.id} requires additional information.
                    </p>
                    <Link href={`/customer/status/${needsActionApp.id}`}>
                      <Button size="sm" className="w-full gap-2 bg-warning text-warning-foreground hover:bg-warning/90">
                        <Upload className="h-4 w-4" />
                        Review Request
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No action required at this time.</p>
                )}
              </CardContent>
            </Card>

            {/* Latest activity */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <Calendar className="h-5 w-5 text-primary" />
                  Latest Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <div className="space-y-3">
                    {applications.slice(0, 2).map((app) => {
                      const meta = STATUS_META[app.status] ?? STATUS_META.draft
                      return (
                        <div key={app.id} className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {app.draftStep ?? "*"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {getApplicationTypeLabel(app.applicationType)} ({meta.label})
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(app.lastSavedAt ?? app.updatedAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Need help */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  MassHealth Customer Service is available Mon–Fri, 8am–5pm ET.
                </p>
                <div className="text-sm">
                  <p className="font-medium text-foreground">{MASSHEALTH_PHONE}</p>
                  <p className="text-muted-foreground">TTY: {MASSHEALTH_TTY_DIRECT}</p>
                </div>
              </CardContent>
            </Card>

            {/* Care team (SW view: show who else has access) */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Social Worker Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <X className="h-3 w-3 text-muted-foreground/40" />
                  Access is managed by the patient from their own dashboard.
                </p>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  )
}
