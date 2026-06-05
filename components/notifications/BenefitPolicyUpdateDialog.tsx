/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Notification } from "@/lib/notifications/types"
import type {
  BenefitPolicyUpdateMetadata,
  PolicyFindingPreview,
} from "@/components/notifications/BenefitPolicyUpdateNotificationCard"

interface Props {
  notification: Notification | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BenefitPolicyUpdateDialog({ notification, open, onOpenChange }: Props) {
  const metadata = notification?.metadata as BenefitPolicyUpdateMetadata | undefined
  const benefitNames = Array.isArray(metadata?.benefitNames) ? metadata.benefitNames : []
  const findings = Array.isArray(metadata?.findings) ? metadata.findings : []
  const findingCount = typeof metadata?.findingCount === "number" ? metadata.findingCount : findings.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{notification?.title ?? "MassHealth policy updates"}</DialogTitle>
          <DialogDescription>
            {findingCount} update(s) found for benefits tied to this application.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(85vh-7rem)] overflow-y-auto px-5 py-4">
          {benefitNames.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {benefitNames.map((name) => (
                <Badge key={name} variant="secondary" className="rounded-sm">
                  {name}
                </Badge>
              ))}
            </div>
          )}

          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No finding details were stored with this notification.
            </p>
          ) : (
            <div className="space-y-3">
              {findings.map((finding, index) => (
                <FindingDetail key={`${finding.source_url ?? "source"}-${index}`} finding={finding} index={index} />
              ))}
            </div>
          )}

          {metadata?.applicationId && (
            <p className="mt-4 text-xs text-muted-foreground">
              Application ID: {metadata.applicationId}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FindingDetail({ finding, index }: { finding: PolicyFindingPreview; index: number }) {
  const evidence = Array.isArray(finding.evidence) ? finding.evidence.filter(Boolean) : []
  const dimensions = [
    ["Benefits", finding.benefits],
    ["Programs", finding.programs],
    ["Diseases", finding.diseases],
    ["Treatments", finding.treatments],
    ["Conditions", finding.conditions],
    ["Effective dates", finding.effective_dates],
  ].filter(([, values]) => Array.isArray(values) && values.length > 0) as Array<[string, string[]]>

  return (
    <section className="rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {index + 1}. {humanize(finding.profile_name || finding.benefits?.[0] || "MassHealth update")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {finding.source_title || "MassHealth source"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {finding.profile_type && (
            <Badge variant="secondary" className="rounded-sm">
              {humanize(finding.profile_type)}
            </Badge>
          )}
          {finding.change_signal && (
            <Badge variant="outline" className="rounded-sm">
              {humanize(finding.change_signal)}
            </Badge>
          )}
        </div>
      </div>

      {dimensions.length > 0 && (
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          {dimensions.map(([label, values]) => (
            <div key={label}>
              <dt className="font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-foreground">{values.map(humanize).join(", ")}</dd>
            </div>
          ))}
        </dl>
      )}

      {evidence.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">Evidence</p>
          <ul className="mt-2 space-y-2">
            {evidence.map((item, evidenceIndex) => (
              <li key={`${item}-${evidenceIndex}`} className="rounded-sm bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {finding.source_url && (
        <a
          href={finding.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900"
        >
          Open source
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </section>
  )
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim()
}
