/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { ExternalLink, FileSearch, Stethoscope } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Notification } from "@/lib/notifications/types"
import { formatRelativeTime } from "@/lib/utils/format"

export interface PolicyFindingPreview {
  source_url?: string
  source_title?: string
  profile_name?: string
  profile_type?: string
  change_signal?: string
  benefits?: string[]
  programs?: string[]
  diseases?: string[]
  treatments?: string[]
  conditions?: string[]
  effective_dates?: string[]
  evidence?: string[]
}

export interface BenefitPolicyUpdateMetadata {
  kind?: string
  applicationId?: string
  benefitNames?: string[]
  findingCount?: number
  findings?: PolicyFindingPreview[]
}

interface Props {
  notification: Notification
  onClick?: (notification: Notification) => void
}

export function BenefitPolicyUpdateNotificationCard({ notification, onClick }: Props) {
  const metadata = notification.metadata as BenefitPolicyUpdateMetadata
  const benefitNames = Array.isArray(metadata.benefitNames) ? metadata.benefitNames : []
  const findings = Array.isArray(metadata.findings) ? metadata.findings : []
  const findingCount = typeof metadata.findingCount === "number" ? metadata.findingCount : findings.length
  const isUnread = !notification.readAt

  return (
    <article className={`bg-card px-4 py-4 ${isUnread ? "bg-muted/20" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50">
          <FileSearch className="h-4 w-4 text-sky-600" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"} text-foreground`}>
                  {notification.title}
                </p>
                {isUnread && <span className="h-2 w-2 rounded-full bg-sky-600" aria-hidden />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>

          {benefitNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {benefitNames.slice(0, 6).map((name) => (
                <Badge key={name} variant="secondary" className="rounded-sm">
                  {name}
                </Badge>
              ))}
              {benefitNames.length > 6 && (
                <Badge variant="outline" className="rounded-sm">
                  +{benefitNames.length - 6}
                </Badge>
              )}
            </div>
          )}

          {findings.length > 0 && (
            <div className="space-y-2">
              {findings.slice(0, 3).map((finding, index) => (
                <PolicyFindingRow key={`${finding.source_url ?? "source"}-${index}`} finding={finding} />
              ))}
              {findingCount > findings.slice(0, 3).length && (
                <p className="text-xs text-muted-foreground">
                  {findingCount - findings.slice(0, 3).length} more update(s) available in the monitor results.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => onClick?.(notification)}>
              Review changes
            </Button>
            {metadata.applicationId && (
              <span className="text-[11px] text-muted-foreground">
                Application {metadata.applicationId.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function PolicyFindingRow({ finding }: { finding: PolicyFindingPreview }) {
  const label = humanize(finding.profile_name || finding.benefits?.[0] || finding.programs?.[0] || "MassHealth")
  const signal = humanize(finding.change_signal || "policy update")
  const evidence = Array.isArray(finding.evidence) ? finding.evidence.filter(Boolean).slice(0, 2) : []

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">{label}</p>
        <Badge variant="outline" className="rounded-sm text-[10px]">
          {signal}
        </Badge>
      </div>

      {evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {evidence.map((item, index) => (
            <li key={`${item}-${index}`} className="text-xs leading-relaxed text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      )}

      {finding.source_url && (
        <a
          href={finding.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900"
        >
          {finding.source_title || "Source"}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim()
}
