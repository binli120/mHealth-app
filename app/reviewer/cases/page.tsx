/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import Link from "next/link"
import { ChevronRight, Filter, Search, SlidersHorizontal, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { APPLICATION_STATUS_FILTER_OPTIONS } from "@/lib/application-status"
import { listReviewerCases } from "@/lib/db/reviewer"
import { UserBadgeIcon } from "@/lib/icons"

import { requireReviewerPage } from "../page-auth"
import {
  ConfidenceBadge,
  ReviewerHeader,
  ReviewerStatusBadge,
  formatApplicationType,
  formatCurrency,
  formatDate,
} from "../_components/reviewer-ui"

interface CasesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function CasesListPage({ searchParams }: CasesPageProps) {
  await requireReviewerPage("/reviewer/cases")
  const params = searchParams ? await searchParams : {}
  const status = firstParam(params.status) ?? null
  const query = firstParam(params.q) ?? ""
  const flagged = firstParam(params.flagged) === "1"
  const agingDays = Number(firstParam(params.aging))
  const result = await listReviewerCases({
    status,
    query,
    flagged,
    agingDays: Number.isFinite(agingDays) ? agingDays : null,
    limit: 50,
  })
  const activeFilterCount = [status, query, flagged, Number.isFinite(agingDays)].filter(Boolean).length

  return (
    <div className="min-h-screen bg-background">
      <ReviewerHeader active="cases" />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">All Cases</h1>
            <p className="mt-1 text-muted-foreground">
              Showing {result.records.length} of {result.total} cases
              {activeFilterCount > 0 ? ` with ${activeFilterCount} active filters` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Reviewer queue
          </div>
        </div>

        <Card className="mb-6 border-border bg-card">
          <CardContent className="p-4">
            <form className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={query}
                  placeholder="Search by case ID, applicant, or email"
                  className="border-input bg-background pl-9 text-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    name="status"
                    defaultValue={status ?? ""}
                    className="h-10 w-[170px] rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground"
                  >
                    {APPLICATION_STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {flagged ? <input type="hidden" name="flagged" value="1" /> : null}
                {Number.isFinite(agingDays) ? <input type="hidden" name="aging" value={String(agingDays)} /> : null}
                <Button type="submit">Apply</Button>
                {activeFilterCount > 0 ? (
                  <Link href="/reviewer/cases">
                    <Button type="button" variant="outline">
                      Clear
                    </Button>
                  </Link>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        {result.records.length === 0 ? (
          <Card className="border-dashed border-border bg-card">
            <CardContent className="p-8 text-center">
              <p className="font-medium text-foreground">No cases match this view</p>
              <p className="mt-1 text-sm text-muted-foreground">Adjust the filters or wait for new submitted applications.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {result.records.map((caseItem) => (
              <Link key={caseItem.id} href={`/reviewer/case/${caseItem.id}`}>
                <Card className="border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="p-0">
                    <div className="flex flex-col lg:flex-row lg:items-center">
                      <div className="flex flex-1 items-center gap-4 p-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                          <UserBadgeIcon color="currentColor" className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{caseItem.applicantName}</p>
                            <ReviewerStatusBadge status={caseItem.status} />
                            {caseItem.flags.map((flag) => (
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

                      <div className="flex flex-wrap items-center gap-6 border-t border-border p-4 lg:border-l lg:border-t-0">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <ConfidenceBadge value={caseItem.confidenceScore} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Household</p>
                          <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {caseItem.householdSize ?? "Not set"}
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Income</p>
                          <p className="text-sm font-medium text-foreground">{formatCurrency(caseItem.totalMonthlyIncome)}/mo</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Age</p>
                          <p className={caseItem.ageDays >= 7 ? "text-sm font-medium text-destructive" : "text-sm font-medium text-foreground"}>
                            {caseItem.ageDays}d
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
