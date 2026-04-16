/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCheck, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { NotificationItem } from "@/components/notifications/NotificationItem"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  markAllRead,
  markRead,
  revertMarkAllRead,
  revertMarkRead,
  setError,
  setLoading,
  setNotifications,
} from "@/lib/redux/features/notifications-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { Notification } from "@/lib/notifications/types"

const TYPE_LABELS: Record<string, string> = {
  all:              "All",
  status_change:    "Status",
  document_request: "Documents",
  renewal_reminder: "Renewals",
  deadline:         "Deadlines",
  general:          "General",
}

export default function NotificationsPage() {
  const dispatch = useAppDispatch()
  const { items, unreadCount, loading, error } = useAppSelector((s) => s.notifications)
  const [filter, setFilter] = useState<string>("all")
  // Keep a stable ref to items for rollback snapshots inside callbacks
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })

  const loadAll = useCallback(async () => {
    dispatch(setLoading(true))
    try {
      const res = await authenticatedFetch("/api/notifications?limit=100")
      const json = await res.json() as { ok: boolean; data: Notification[] }
      if (json.ok) dispatch(setNotifications(json.data))
      else dispatch(setError("Failed to load notifications."))
    } catch {
      dispatch(setError("Failed to load notifications."))
    }
  }, [dispatch])

  useEffect(() => { loadAll() }, [loadAll])

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = itemsRef.current.filter((n) => !n.readAt).map((n) => n.id)
    const prevCount = unreadIds.length
    dispatch(markAllRead())
    try {
      await authenticatedFetch("/api/notifications/read-all", { method: "POST" })
    } catch {
      dispatch(revertMarkAllRead({ unreadIds, prevCount }))
      dispatch(setError("Failed to mark all as read. Please try again."))
    }
  }, [dispatch])

  const handleItemClick = useCallback(async (notification: Notification) => {
    const wasUnread = !notification.readAt
    dispatch(markRead(notification.id))
    try {
      await authenticatedFetch(`/api/notifications/${notification.id}/read`, { method: "POST" })
    } catch {
      if (wasUnread) dispatch(revertMarkRead(notification.id))
    }
  }, [dispatch])

  const filtered = filter === "all" ? items : items.filter((n) => n.type === filter)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/customer/dashboard">
          <Button variant="ghost" size="icon" aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(TYPE_LABELS).map(([key, label]) => {
          const count = key === "all"
            ? items.filter((n) => !n.readAt).length
            : items.filter((n) => n.type === key && !n.readAt).length
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                filter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                  {count}
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      <Separator className="mb-1" />

      {/* Content */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {filter === "all" ? "No notifications yet." : `No ${TYPE_LABELS[filter]?.toLowerCase()} notifications.`}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {filtered.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={handleItemClick} />
          ))}
        </div>
      )}
    </div>
  )
}
