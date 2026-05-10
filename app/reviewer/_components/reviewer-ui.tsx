/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import Link from "next/link"
import { Bell, LogOut } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  APPLICATION_STATUS_BADGE_STYLES,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_SET,
  type ApplicationStatus,
} from "@/lib/application-status"
import { ShieldHeartIcon, UserBadgeIcon } from "@/lib/icons"

const NAV_ITEMS = [
  { href: "/reviewer/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/reviewer/cases", label: "Cases", key: "cases" },
  { href: "/reviewer/audit", label: "Audit Log", key: "audit" },
] as const

export type ReviewerNavKey = (typeof NAV_ITEMS)[number]["key"]

export function ReviewerHeader({ active }: { active: ReviewerNavKey }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-sidebar">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <ShieldHeartIcon color="currentColor" className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <span className="text-lg font-semibold text-sidebar-foreground">HealthCompass MA</span>
            <span className="ml-2 rounded-full bg-sidebar-accent px-2 py-0.5 text-xs font-medium text-sidebar-accent-foreground">
              Reviewer Portal
            </span>
          </div>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                item.key === active
                  ? "text-sm font-medium text-sidebar-foreground"
                  : "text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-sidebar-foreground" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground" aria-label="Reviewer profile">
            <UserBadgeIcon color="currentColor" className="h-5 w-5" />
          </Button>
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-sidebar-foreground" aria-label="Leave reviewer portal">
              <LogOut className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

export function ReviewerStatusBadge({ status }: { status: string }) {
  const normalized = APPLICATION_STATUS_SET.has(status) ? (status as ApplicationStatus) : null
  const label = normalized
    ? APPLICATION_STATUS_LABELS[normalized]
    : status.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  const style = normalized
    ? APPLICATION_STATUS_BADGE_STYLES[normalized]
    : "bg-secondary text-secondary-foreground"

  return (
    <Badge variant="outline" className={`border-transparent text-xs ${style}`}>
      {label}
    </Badge>
  )
}

export function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-sm text-muted-foreground">Not scored</span>
  }

  const style =
    value >= 90
      ? "bg-success/10 text-success"
      : value >= 75
        ? "bg-warning/10 text-warning"
        : "bg-destructive/10 text-destructive"

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {Math.round(value)}%
    </span>
  )
}

export function formatDate(value: string | null): string {
  if (!value) return "Not set"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export function formatDateTime(value: string | null): string {
  if (!value) return "Not set"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatCurrency(value: number | null): string {
  if (value === null) return "Not provided"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatApplicationType(value: string | null): string {
  if (!value) return "Application"
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatFileSize(value: number | null): string {
  if (value === null) return "Size unavailable"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
