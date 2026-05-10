/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import Link from "next/link"
import {
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Send,
  Shield,
  XCircle,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { listReviewerAuditEvents } from "@/lib/db/reviewer"
import { UserBadgeIcon } from "@/lib/icons"

import { ReviewerHeader, formatDateTime } from "../_components/reviewer-ui"
import { requireReviewerPage } from "../page-auth"

function iconForAction(action: string) {
  if (action.includes("Approved")) return { Icon: CheckCircle2, color: "text-success" }
  if (action.includes("Denied")) return { Icon: XCircle, color: "text-destructive" }
  if (action.includes("Rfi") || action.includes("RFI")) return { Icon: Send, color: "text-warning" }
  if (action.includes("Document")) return { Icon: FileText, color: "text-primary" }
  if (action.includes("Updated")) return { Icon: Edit3, color: "text-primary" }
  if (action.includes("PHI")) return { Icon: Shield, color: "text-destructive" }
  return { Icon: Clock, color: "text-muted-foreground" }
}

export default async function AuditLogPage() {
  await requireReviewerPage("/reviewer/audit")
  const auditLogs = await listReviewerAuditEvents({ limit: 50 })

  return (
    <div className="min-h-screen bg-background">
      <ReviewerHeader active="audit" />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Audit Log</h1>
          <p className="mt-1 text-muted-foreground">Application activity history available to reviewers</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Last event: {auditLogs[0] ? formatDateTime(auditLogs[0].occurredAt) : "No activity logged yet"}
          </p>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-medium text-foreground">No audit events yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Application events will appear here as cases move through review.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {auditLogs.map((log) => {
                  const { Icon, color } = iconForAction(log.action)
                  return (
                    <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-secondary/30">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary ${color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{log.action}</p>
                          <Link href={`/reviewer/case/${log.applicationId}`}>
                            <span className="font-mono text-sm text-primary hover:underline">
                              {log.applicationDisplayId}
                            </span>
                          </Link>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{log.details}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <UserBadgeIcon color="currentColor" className="h-3 w-3" />
                            {log.actorEmail ?? log.applicantName}
                          </span>
                          <span className="rounded-full bg-secondary px-2 py-0.5">{log.actorRole}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Timestamp: {formatDateTime(log.occurredAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
