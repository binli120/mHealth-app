/**
 * SwChatDialog
 * Floating chat dialog for social workers.
 *
 * Replaces the /social-worker/messages full-page route.
 * Renders as a fixed bottom-right panel with two tabs:
 *   • Conversations — click a thread to open SwDirectChatPanel inline
 *   • Requests      — pending engagement requests via EngagementRequestsPanel
 *
 * @author Bin Lee
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Bell, Loader2, MessageSquare, UserCheck, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSupabaseClient } from "@/lib/supabase/client"
import { EngagementRequestsPanel } from "@/components/social-worker/engagement-requests-panel"
import { SwDirectChatPanel } from "@/components/chat/sw-direct-chat-panel"
import type { DirectMessage } from "@/components/chat/sw-direct-chat-panel"

// ── Types ─────────────────────────────────────────────────────────────────────

interface MessageThread {
  patientUserId: string
  patientName: string | null
  patientEmail: string
  lastMessageAt: string | null
  lastMessageContent: string | null
  unreadCount: number
}

type DialogTab = "messages" | "requests"
type DialogView = "threads" | "chat"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SwChatDialog() {
  const [open, setOpen]                   = useState(false)
  const [tab, setTab]                     = useState<DialogTab>("messages")
  const [view, setView]                   = useState<DialogView>("threads")
  const [activePatient, setActivePatient] = useState<{ userId: string; name: string } | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [threads, setThreads]             = useState<MessageThread[]>([])
  const [pendingCount, setPendingCount]   = useState(0)
  const [totalUnread, setTotalUnread]     = useState(0)
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [messageCache, setMessageCache]   = useState<Record<string, DirectMessage[]>>({})

  // Resolve current user once
  useEffect(() => {
    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session?.user) setCurrentUserId(data.session.user.id)
      })
  }, [])

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true)
    try {
      const res  = await authenticatedFetch("/api/social-worker/messages")
      const data = await res.json()
      if (data.ok) {
        const t: MessageThread[] = data.threads ?? []
        setThreads(t)
        setTotalUnread(t.reduce((sum, th) => sum + th.unreadCount, 0))
      }
    } finally {
      setLoadingThreads(false)
    }
  }, [])

  const fetchPendingCount = useCallback(async () => {
    try {
      const res  = await authenticatedFetch("/api/social-worker/engagement-requests")
      const data = await res.json()
      setPendingCount((data.requests ?? []).length)
    } catch {
      // non-critical
    }
  }, [])

  // Refresh data whenever the dialog opens
  useEffect(() => {
    if (!open) return
    void fetchThreads()
    void fetchPendingCount()
  }, [open, fetchThreads, fetchPendingCount])

  // Poll badge count even when dialog is closed so the button stays up to date
  useEffect(() => {
    const poll = async () => {
      try {
        const [reqRes, threadRes] = await Promise.all([
          authenticatedFetch("/api/social-worker/engagement-requests"),
          authenticatedFetch("/api/social-worker/messages"),
        ])
        const reqData    = await reqRes.json()
        const threadData = await threadRes.json()
        setPendingCount((reqData.requests ?? []).length)
        const t: MessageThread[] = threadData.threads ?? []
        setTotalUnread(t.reduce((sum, th) => sum + th.unreadCount, 0))
      } catch { /* non-critical */ }
    }
    void poll()
    const id = setInterval(() => void poll(), 30_000)
    return () => clearInterval(id)
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────

  function openChat(patientUserId: string, patientName: string) {
    setActivePatient({ userId: patientUserId, name: patientName })
    setView("chat")
  }

  function goBack() {
    setView("threads")
    setActivePatient(null)
    void fetchThreads()   // refresh unread counts after returning from a chat
  }

  const badge = pendingCount + totalUnread

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating trigger ──────────────────────────────────────────────── */}
      {/* Outer div owns `fixed` placement; inner button has `relative` so the
          badge <span> with `absolute` positions correctly relative to the button.
          A `position: fixed` element cannot itself be a containing block for
          `absolute` children — the wrapper pattern is required.            */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg transition-all hover:bg-slate-700 hover:scale-105 hover:shadow-xl"
          aria-label="Patient messages"
        >
          <MessageSquare className="h-6 w-6" />
          {badge > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </button>
      </div>

      {/* ── Dialog panel ──────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[540px] w-[380px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">

          {/* Header */}
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
            {/* Back button — only visible in chat view */}
            {view === "chat" && (
              <button
                onClick={goBack}
                className="mr-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}

            <MessageSquare className="h-4 w-4 shrink-0 text-primary" />

            <span className="flex-1 truncate text-sm font-semibold">
              {view === "chat" && activePatient
                ? activePatient.name
                : "Patient Messages"}
            </span>

            {/* Unread badge in thread-list view */}
            {view === "threads" && badge > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 text-xs">{badge}</Badge>
            )}

            {/* Patient role badge in chat view */}
            {view === "chat" && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <UserCheck className="h-3 w-3" />
                Patient
              </Badge>
            )}

            <button
              onClick={() => setOpen(false)}
              className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Thread-list view ────────────────────────────────────────── */}
          {view === "threads" && (
            <>
              {/* Tab bar */}
              <div className="flex shrink-0 gap-1 border-b px-3 py-2">
                <button
                  onClick={() => setTab("messages")}
                  className={[
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    tab === "messages"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversations
                  {totalUnread > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[10px]">{totalUnread}</Badge>
                  )}
                </button>

                <button
                  onClick={() => setTab("requests")}
                  className={[
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    tab === "requests"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <Bell className="h-3.5 w-3.5" />
                  Requests
                  {pendingCount > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[10px]">{pendingCount}</Badge>
                  )}
                </button>
              </div>

              {/* Conversations list */}
              {tab === "messages" && (
                <ScrollArea className="flex-1 px-3 py-2">
                  {loadingThreads ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : threads.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
                      <p className="text-xs text-muted-foreground">
                        Accept a patient request to start messaging.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1"
                        onClick={() => setTab("requests")}
                      >
                        View Requests
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {threads.map((thread) => (
                        <button
                          key={thread.patientUserId}
                          onClick={() =>
                            openChat(
                              thread.patientUserId,
                              thread.patientName ?? thread.patientEmail,
                            )
                          }
                          className="flex w-full items-start gap-3 rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-muted/40"
                        >
                          {/* Avatar */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {(thread.patientName ?? thread.patientEmail).charAt(0).toUpperCase()}
                          </div>

                          {/* Name + preview */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="truncate text-sm font-semibold">
                                {thread.patientName ?? thread.patientEmail}
                              </p>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatRelative(thread.lastMessageAt)}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {thread.lastMessageContent ?? "No messages yet"}
                            </p>
                          </div>

                          {/* Unread badge */}
                          {thread.unreadCount > 0 && (
                            <Badge className="h-5 min-w-5 shrink-0 px-1.5 text-xs">
                              {thread.unreadCount}
                            </Badge>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}

              {/* Requests tab */}
              {tab === "requests" && (
                <ScrollArea className="flex-1 px-3 py-2">
                  <EngagementRequestsPanel
                    onAccepted={() => {
                      setPendingCount((c) => Math.max(0, c - 1))
                      void fetchThreads()
                      setTab("messages")
                    }}
                  />
                </ScrollArea>
              )}
            </>
          )}

          {/* ── Chat view ───────────────────────────────────────────────── */}
          {view === "chat" && activePatient && currentUserId && (
            <SwDirectChatPanel
              swUserId={activePatient.userId}
              swName={activePatient.name}
              currentUserId={currentUserId}
              contactRole="Patient"
              showHeader={false}
              initialMessages={messageCache[activePatient.userId]}
              onMessagesChange={(msgs) =>
                setMessageCache((prev) => ({ ...prev, [activePatient.userId]: msgs }))
              }
              onBack={goBack}
            />
          )}

        </div>
      )}
    </>
  )
}
