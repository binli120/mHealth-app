/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * SW portal: panel showing incoming patient engagement requests with accept/reject actions.
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  UserCheck,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

// ── Types ─────────────────────────────────────────────────────────────────────

interface EngagementRequest {
  id: string
  patientUserId: string
  patientName: string | null
  patientEmail: string
  patientMessage: string | null
  status: "pending" | "accepted" | "rejected" | "cancelled"
  createdAt: string
}

interface EngagementRequestsPanelProps {
  onAccepted?: (patientUserId: string, patientName: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EngagementRequestsPanel({ onAccepted }: EngagementRequestsPanelProps) {
  const [requests, setRequests] = useState<EngagementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectionNote, setRejectionNote] = useState<Record<string, string>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    try {
      const res = await authenticatedFetch("/api/social-worker/engagement-requests")
      const data = await res.json()
      if (data.ok) setRequests(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRequests()
  }, [fetchRequests])

  const handleAccept = async (requestId: string, req: EngagementRequest) => {
    setActingId(requestId)
    try {
      const res = await authenticatedFetch(
        `/api/social-worker/engagement-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept" }),
        },
      )
      const data = await res.json()
      if (data.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId))
        onAccepted?.(req.patientUserId, req.patientName ?? req.patientEmail)
      }
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    setActingId(requestId)
    try {
      const res = await authenticatedFetch(
        `/api/social-worker/engagement-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            rejectionNote: rejectionNote[requestId] || undefined,
          }),
        },
      )
      const data = await res.json()
      if (data.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId))
        setRejectingId(null)
      }
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
        <UserCheck className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No pending requests</p>
        <p className="text-xs">Patients who want your help will appear here.</p>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-xs"
          onClick={() => { setLoading(true); void fetchRequests() }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Pending Requests
          <Badge className="ml-2 text-xs" variant="secondary">{requests.length}</Badge>
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs"
          onClick={() => { setLoading(true); void fetchRequests() }}
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      <ScrollArea className="max-h-[420px]">
        <div className="space-y-3 pr-1">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              {/* Patient info */}
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(req.patientName ?? req.patientEmail).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {req.patientName ?? "Unknown Patient"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{req.patientEmail}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(req.createdAt).toLocaleDateString([], {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Optional message from patient */}
              {req.patientMessage && (
                <div className="mb-3 flex gap-2 rounded-lg bg-muted/60 px-3 py-2">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground italic">&ldquo;{req.patientMessage}&rdquo;</p>
                </div>
              )}

              {/* Reject note input (shown when rejecting) */}
              {rejectingId === req.id && (
                <div className="mb-3">
                  <Input
                    value={rejectionNote[req.id] ?? ""}
                    onChange={(e) =>
                      setRejectionNote((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                    placeholder="Optional: kind note to the patient…"
                    className="text-sm"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  disabled={actingId === req.id}
                  onClick={() => void handleAccept(req.id, req)}
                >
                  {actingId === req.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Accept
                </Button>

                {rejectingId === req.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 gap-1"
                      disabled={actingId === req.id}
                      onClick={() => void handleReject(req.id)}
                    >
                      {actingId === req.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejectingId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setRejectingId(req.id)}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Decline
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
