/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * SW Messages page — shows pending engagement requests + existing message threads.
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Loader2, MessageSquare, UserCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { formatRelativeTime } from "@/lib/utils/format"
import { EngagementRequestsPanel } from "@/components/social-worker/engagement-requests-panel"
import type { MessageThread, Tab } from "./page.types"

// ── Component ─────────────────────────────────────────────────────────────────

export default function SwMessagesPage() {
  const [tab, setTab] = useState<Tab>("requests")
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true)
    try {
      const res = await authenticatedFetch("/api/social-worker/messages")
      const data = await res.json()
      if (data.ok) setThreads(data.threads ?? [])
    } finally {
      setLoadingThreads(false)
    }
  }, [])

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await authenticatedFetch("/api/social-worker/engagement-requests")
      const data = await res.json()
      setPendingCount((data.requests ?? []).length)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    void fetchThreads()
    void fetchPendingCount()
  }, [fetchThreads, fetchPendingCount])

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Manage patient requests and your conversations.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 rounded-lg border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={[
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "requests"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Bell className="h-4 w-4" />
          Requests
          {pendingCount > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 text-xs">{pendingCount}</Badge>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("messages")}
          className={[
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "messages"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <MessageSquare className="h-4 w-4" />
          Conversations
          {threads.reduce((sum, t) => sum + t.unreadCount, 0) > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 text-xs">
              {threads.reduce((sum, t) => sum + t.unreadCount, 0)}
            </Badge>
          )}
        </button>
      </div>

      {/* Requests tab */}
      {tab === "requests" && (
        <EngagementRequestsPanel
          onAccepted={() => {
            setPendingCount((c) => Math.max(0, c - 1))
            void fetchThreads()
            setTab("messages")
          }}
        />
      )}

      {/* Conversations tab */}
      {tab === "messages" && (
        <div>
          {loadingThreads ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs">Accept a patient request to start messaging.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTab("requests")}
              >
                View Requests
              </Button>
            </div>
          ) : (
            <ScrollArea>
              <div className="space-y-2">
                {threads.map((thread) => (
                  <Link
                    key={thread.patientUserId}
                    href={`/social-worker/messages/${thread.patientUserId}`}
                    className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(thread.patientName ?? thread.patientEmail).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {thread.patientName ?? thread.patientEmail}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {thread.lastMessageAt ? formatRelativeTime(thread.lastMessageAt, { capitalize: true }) : ""}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {thread.lastMessageContent ?? "No messages yet"}
                      </p>
                    </div>
                    {thread.unreadCount > 0 && (
                      <Badge className="shrink-0 h-5 min-w-5 px-1.5 text-xs">
                        {thread.unreadCount}
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
