/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import * as React from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AdminPageShellProps extends React.ComponentProps<"div"> {
  size?: "default" | "wide" | "narrow"
}

const shellSizeClass = {
  default: "max-w-6xl",
  wide: "max-w-7xl",
  narrow: "max-w-3xl",
}

function AdminPageShell({
  size = "default",
  className,
  ...props
}: AdminPageShellProps) {
  return (
    <div
      className={cn("mx-auto w-full space-y-6 pb-10", shellSizeClass[size], className)}
      {...props}
    />
  )
}

interface AdminPageHeaderProps {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

function AdminPageHeader({
  title,
  description,
  action,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">
          {title}
        </h1>
        {description && (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  )
}

function AdminToolbar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
      {...props}
    />
  )
}

function AdminPanel({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={cn("gap-0 overflow-hidden rounded-lg py-0", className)} {...props} />
}

function AdminPanelHeader({
  className,
  ...props
}: React.ComponentProps<typeof CardHeader>) {
  return (
    <CardHeader
      className={cn("border-b px-4 py-4 sm:px-5", className)}
      {...props}
    />
  )
}

function AdminPanelContent({
  className,
  ...props
}: React.ComponentProps<typeof CardContent>) {
  return <CardContent className={cn("px-4 py-4 sm:px-5", className)} {...props} />
}

interface AdminMetricCardProps {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  href?: string
  tone?: "primary" | "warning" | "success" | "danger" | "neutral"
  alert?: boolean
}

const metricToneClass = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning-foreground",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
}

function AdminMetricCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "primary",
  alert,
}: AdminMetricCardProps) {
  const content = (
    <div className="flex min-h-28 items-center gap-4 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30">
      <div className={cn("rounded-md p-2.5", metricToneClass[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          {value}
          {alert && <span className="size-2 rounded-full bg-warning" />}
        </div>
        <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  )

  if (!href) return content

  return (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  )
}

function AdminTablePanel({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card shadow-sm", className)}>
      {children}
    </div>
  )
}

interface AdminPaginationProps {
  page: number
  pageSize: number
  total: number
  onPrevious: () => void
  onNext: () => void
}

function AdminPagination({
  page,
  pageSize,
  total,
  onPrevious,
  onNext,
}: AdminPaginationProps) {
  if (total <= pageSize) return null

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={(page + 1) * pageSize >= total}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

interface AdminStatusBadgeProps {
  children: React.ReactNode
  tone?: "success" | "warning" | "danger" | "neutral" | "primary"
  className?: string
}

const statusToneClass = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
}

function AdminStatusBadge({
  children,
  tone = "neutral",
  className,
}: AdminStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        statusToneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

function AdminRecordList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-3 md:hidden", className)} {...props} />
}

function AdminRecordCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}
      {...props}
    />
  )
}

function AdminDesktopTable({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("hidden overflow-x-auto md:block", className)} {...props} />
}

export {
  AdminDesktopTable,
  AdminMetricCard,
  AdminPageHeader,
  AdminPageShell,
  AdminPagination,
  AdminPanel,
  AdminPanelContent,
  AdminPanelHeader,
  AdminRecordCard,
  AdminRecordList,
  AdminStatusBadge,
  AdminTablePanel,
  AdminToolbar,
  CardTitle as AdminPanelTitle,
}
