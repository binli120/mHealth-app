/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useCallback, useMemo, useState } from "react"
import { useAsyncData } from "@/hooks/use-async-data"
import { useDebounce } from "@/hooks/use-debounce"
import { getMessage } from "@/lib/i18n/messages"
import { formatDate } from "@/lib/utils/format"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { ArrowLeft, ChevronRight, Filter, Search } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShieldHeartIcon } from "@/lib/icons"
import { useAppSelector } from "@/lib/redux/hooks"
import type { ApplicationListApiResponse, StatusFilter } from "./page.types"
import {
  getLocalizedApplicationTypeLabel,
  getStatusConfig,
  getStatusFilterOptions,
} from "./page.utils"

export default function StatusListPage() {
  const language = useAppSelector((state) => state.app.language)
  const [searchInput, setSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const statusConfig = useMemo(() => getStatusConfig(language), [language])
  const statusFilterOptions = useMemo(() => getStatusFilterOptions(language), [language])

  // Debounce search so we don't fire on every keystroke
  const debouncedSearch = useDebounce(searchInput, 250)

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams()
    params.set("limit", "100")
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())

    const response = await authenticatedFetch(`/api/applications?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => ({}))) as ApplicationListApiResponse
    if (!response.ok || !payload.ok) throw new Error(payload.error || getMessage(language, "dashboardLoadingApps"))
    return payload.records ?? []
  }, [debouncedSearch, language, statusFilter])

  const { data: applicationsData, isLoading, error: loadError, reload: loadApplications } =
    useAsyncData(fetcher)
  const applications = useMemo(() => applicationsData ?? [], [applicationsData])

  const draftsCount = useMemo(
    () => applications.filter((app) => app.status === "draft").length,
    [applications],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            href="/customer/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{getMessage(language, "statusListBackToDashboard")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">HealthCompass MA</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{getMessage(language, "statusListTitle")}</h1>
          <p className="mt-1 text-muted-foreground">
            {getMessage(language, "statusListSubtitle")}
          </p>
        </div>

        <Card className="mb-6 border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value)
                  }}
                  placeholder={getMessage(language, "statusListSearchPlaceholder")}
                  className="border-input bg-background pl-9 text-foreground"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as StatusFilter)
                }}
              >
                <SelectTrigger className="w-full border-input bg-background text-foreground sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={getMessage(language, "statusListFilterPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {isLoading ? (
            <Card className="border-border bg-card">
              <CardContent className="p-4 text-sm text-muted-foreground">
                {getMessage(language, "statusListLoading")}
              </CardContent>
            </Card>
          ) : loadError ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadApplications()}>
                  {getMessage(language, "statusListRetry")}
                </Button>
              </CardContent>
            </Card>
          ) : applications.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="p-4 text-sm text-muted-foreground">
                {getMessage(language, "statusListEmpty")}
              </CardContent>
            </Card>
          ) : (
            applications.map((app) => {
              const status = statusConfig[app.status]
              const StatusIcon = status.icon
              const needsAction = app.status === "rfi_requested"
              const detailHref =
                app.status === "draft"
                  ? `/application/new?applicationId=${app.id}`
                  : `/customer/status/${app.id}`

              return (
                <Link key={app.id} href={detailHref}>
                  <Card
                    className={`border-border bg-card transition-all hover:border-primary/50 hover:shadow-md ${needsAction ? "ring-2 ring-warning" : ""}`}
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row">
                        <div className={`flex items-center justify-center p-4 sm:w-32 ${status.color}`}>
                          <div className="text-center">
                            <StatusIcon className="mx-auto h-6 w-6" />
                            <p className="mt-1 text-xs font-medium">{status.label}</p>
                          </div>
                        </div>

                        <div className="flex flex-1 items-center justify-between p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">
                                {getLocalizedApplicationTypeLabel(app.applicationType, language)}
                              </h3>
                              {needsAction ? (
                                <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-medium text-warning-foreground">
                                  {getMessage(language, "statusListActionRequired")}
                                </span>
                              ) : null}
                              {app.status === "draft" ? (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                                  {getMessage(language, "statusListContinue")}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 font-mono text-sm text-muted-foreground">{app.id}</p>
                            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                              <span>{getMessage(language, "statusListUpdated")}: {formatDate(app.lastSavedAt ?? app.updatedAt)}</span>
                              <span>{getMessage(language, "statusListSubmitted")}: {formatDate(app.submittedAt)}</span>
                              <span>
                                {getMessage(language, "statusListHousehold")}:{" "}
                                {typeof app.householdSize === "number" ? app.householdSize : "—"}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })
          )}
        </div>

        <Card className="mt-8 border-border bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-card-foreground">{getMessage(language, "statusListNeedHelp")}</CardTitle>
            <CardDescription>
              {`${getMessage(language, "statusListActiveDraftsPrefix")} ${draftsCount}. ${getMessage(language, "statusListActiveDraftsSuffix")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">{getMessage(language, "statusListContactSupport")}</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
