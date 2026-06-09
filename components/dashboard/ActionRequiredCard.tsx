"use client"

import Link from "next/link"
import { AlertCircle, Clock, Shield, Lock, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { buildApplicationContinueHref } from "@/lib/applications/navigation"
import { getApplicationTypeLabel } from "@/lib/masshealth/application-types"
import { getUpcomingDeadlines } from "@/lib/masshealth/deadlines"
import { formatDate } from "@/lib/utils/format"
import type { ApplicationListRecord } from "@/lib/applications/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { getMessage } from "@/lib/i18n/messages"

const STALE_DRAFT_DAYS = 14

interface ActionItem {
  key: string
  priority: number
  borderColor: string
  icon: React.ElementType
  label: string
  sublabel: string
  href?: string
  ctaLabel?: string
  isPlaceholder?: boolean
}

function computeActionItems(
  applications: ApplicationListRecord[],
  now: Date,
): ActionItem[] {
  const items: ActionItem[] = []

  // Priority 1: MassHealth deadlines
  const deadlines = getUpcomingDeadlines(now, 30)
  for (const d of deadlines) {
    const daysLeft = Math.ceil(
      (new Date(d.isoDate).getTime() - now.getTime()) / 86400_000,
    )
    items.push({
      key: `deadline-${d.isoDate}`,
      priority: 1,
      borderColor: "border-l-destructive",
      icon: AlertCircle,
      label: `Deadline in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      sublabel: d.label,
      href: "/customer/status",
      ctaLabel: "Review applications",
    })
  }

  // Priority 2: RFI requested
  for (const app of applications.filter((a) => a.status === "rfi_requested")) {
    items.push({
      key: `rfi-${app.id}`,
      priority: 2,
      borderColor: "border-l-destructive",
      icon: AlertCircle,
      label: "Information requested",
      sublabel: `${getApplicationTypeLabel(app.applicationType)} · ${app.id.slice(0, 8)}`,
      href: `/customer/status/${app.id}`,
      ctaLabel: "Review request",
    })
  }

  // Priority 3: SW-modified pending confirmation
  for (const app of applications.filter((a) => a.needsCustomerReview)) {
    items.push({
      key: `sw-review-${app.id}`,
      priority: 3,
      borderColor: "border-l-amber-500",
      icon: UserCheck,
      label: "Social worker updated your application",
      sublabel: app.swLastModifiedAt
        ? `Updated ${formatDate(app.swLastModifiedAt)} · ${app.id.slice(0, 8)}`
        : app.id.slice(0, 8),
      href: `/customer/status/${app.id}`,
      ctaLabel: "Review changes",
    })
  }

  // Priority 4: Stale drafts (not touched in 14+ days)
  const staleMs = STALE_DRAFT_DAYS * 86400_000
  for (const app of applications.filter((a) => a.status === "draft")) {
    const lastTouched = new Date(
      app.lastSavedAt ?? app.updatedAt ?? app.createdAt,
    ).getTime()
    if (now.getTime() - lastTouched >= staleMs) {
      const daysOld = Math.floor((now.getTime() - lastTouched) / 86400_000)
      items.push({
        key: `stale-${app.id}`,
        priority: 4,
        borderColor: "border-l-muted-foreground",
        icon: Clock,
        label: `Application started ${daysOld} day${daysOld === 1 ? "" : "s"} ago`,
        sublabel: `${getApplicationTypeLabel(app.applicationType)} · pick up where you left off`,
        href: buildApplicationContinueHref(app.id),
        ctaLabel: "Continue",
      })
    }
  }

  // Priority 5: Security placeholders (always shown, de-emphasized)
  items.push(
    {
      key: "security-sessions",
      priority: 5,
      borderColor: "border-l-border",
      icon: Shield,
      label: "Review active login sessions",
      sublabel: "Manage where your account is signed in",
      isPlaceholder: true,
    },
    {
      key: "security-recovery",
      priority: 5,
      borderColor: "border-l-border",
      icon: Lock,
      label: "Verify recovery options",
      sublabel: "Ensure your email and backup codes are up to date",
      isPlaceholder: true,
    },
  )

  return items.sort((a, b) => a.priority - b.priority)
}

interface Props {
  applications: ApplicationListRecord[]
  now?: Date
  language: SupportedLanguage
}

export function ActionRequiredCard({ applications, now = new Date(), language }: Props) {
  const items = computeActionItems(applications, now)
  const activeItems = items.filter((i) => !i.isPlaceholder)
  const placeholderItems = items.filter((i) => i.isPlaceholder)

  return (
    <Card className="border-warning/50 bg-warning/5" data-tour="dashboard-action-required">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
          <AlertCircle className="h-5 w-5 text-warning" />
          {getMessage(language, "dashboardActionRequired")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeItems.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            {getMessage(language, "dashboardNoActionRequired")}
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {activeItems.map((item) => (
              <ActionItemRow key={item.key} item={item} />
            ))}
          </ul>
        )}

        {placeholderItems.length > 0 && (
          <div className="space-y-2 opacity-50">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Coming soon
            </p>
            <ul className="space-y-2">
              {placeholderItems.map((item) => (
                <ActionItemRow key={item.key} item={item} />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActionItemRow({ item }: { item: ActionItem }) {
  const Icon = item.icon
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border border-l-4 bg-card px-3 py-2 ${item.borderColor} border-border`}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.label}</p>
        <p className="truncate text-xs text-muted-foreground">{item.sublabel}</p>
      </div>
      {item.ctaLabel && item.href && (
        <Button asChild size="sm" variant="outline" className="shrink-0 text-xs">
          <Link href={item.href}>{item.ctaLabel}</Link>
        </Button>
      )}
    </li>
  )
}
