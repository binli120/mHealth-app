/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserBadgeIcon } from "@/lib/icons"
import { getReviewerDashboard } from "@/lib/db/reviewer"

import { requireReviewerPage } from "../page-auth"
import {
  ConfidenceBadge,
  ReviewerHeader,
  ReviewerStatusBadge,
  formatApplicationType,
  formatCurrency,
  formatDate,
} from "../_components/reviewer-ui"

export default async function ReviewerDashboardPage() {
  await requireReviewerPage("/reviewer/dashboard")
  const { stats, recentCases } = await getReviewerDashboard()

  const statCards = [
    {
      label: "Pending Review",
      value: stats.pendingReview,
      icon: Clock,
      color: "bg-primary/10 text-primary",
      href: "/reviewer/cases?status=needs_review",
    },
    {
      label: "RFI Required",
      value: stats.rfiRequired,
      icon: AlertCircle,
      color: "bg-warning/10 text-warning",
      href: "/reviewer/cases?status=rfi_requested",
    },
    {
      label: "Approved",
      value: stats.approved,
      icon: CheckCircle2,
      color: "bg-success/10 text-success",
      href: "/reviewer/cases?status=approved",
    },
    {
      label: "Flagged",
      value: stats.flagged,
      icon: AlertTriangle,
      color: "bg-destructive/10 text-destructive",
      href: "/reviewer/cases?flagged=1",
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <ReviewerHeader active="dashboard" />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Reviewer Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              {stats.pendingReview} cases awaiting review across {stats.total} submitted applications
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Link key={stat.label} href={stat.href}>
                <Card className="border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-4">
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {stats.agingOverSeven > 0 ? (
          <Card className="mb-8 border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{stats.agingOverSeven} cases aging over 7 days</p>
                <p className="text-sm text-muted-foreground">These cases are still in active review states.</p>
              </div>
              <Link href="/reviewer/cases?aging=7">
                <Button variant="outline" size="sm" className="gap-2">
                  View Cases
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-card-foreground">Recent Cases</CardTitle>
                <CardDescription>Latest application activity available to reviewers</CardDescription>
              </div>
              <Link href="/reviewer/cases">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentCases.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="font-medium text-foreground">No submitted cases yet</p>
                <p className="mt-1 text-sm text-muted-foreground">New applications will appear here after submission.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCases.map((caseItem) => (
                  <Link key={caseItem.id} href={`/reviewer/case/${caseItem.id}`}>
                    <div className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                          <UserBadgeIcon color="currentColor" className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{caseItem.applicantName}</p>
                            <ReviewerStatusBadge status={caseItem.status} />
                            {caseItem.flags.slice(0, 2).map((flag) => (
                              <Badge key={flag} variant="outline" className="bg-secondary/50 text-xs">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="font-mono">{caseItem.displayId}</span>
                            <span>{formatApplicationType(caseItem.applicationType)}</span>
                            <span>Submitted: {formatDate(caseItem.submittedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Confidence:</span>
                          <ConfidenceBadge value={caseItem.confidenceScore} />
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{caseItem.householdSize ?? "Not set"}</span>
                        </div>
                        <span className="text-muted-foreground">{formatCurrency(caseItem.totalMonthlyIncome)}/mo</span>
                        <span className={caseItem.ageDays >= 7 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                          {caseItem.ageDays}d old
                        </span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
