"use client"

import { useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BellOff, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  setUnreadCount,
} from "@/lib/redux/features/notifications-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { Notification } from "@/lib/notifications/types"

/** Only allow internal paths — block open-redirect via metadata actionUrl. */
function isSafeInternalPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.includes("://")
}

interface Props {
  children: React.ReactNode
}

export function NotificationDropdown({ children }: Props) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const { items, unreadCount, loading, error } = useAppSelector((s) => s.notifications)

  const loadNotifications = useCallback(async () => {
    dispatch(setLoading(true))
    try {
      const res = await authenticatedFetch("/api/notifications?limit=20")
      const json = await res.json() as { ok: boolean; data: Notification[] }
      if (json.ok) dispatch(setNotifications(json.data))
    } catch {
      dispatch(setError("Failed to load notifications."))
    }
  }, [dispatch])

  const handleMarkAllRead = useCallback(async () => {
    // Snapshot unread state before optimistic update so we can roll back on failure
    const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id)
    const prevCount = unreadCount
    dispatch(markAllRead())
    try {
      await authenticatedFetch("/api/notifications/read-all", { method: "POST" })
    } catch {
      dispatch(revertMarkAllRead({ unreadIds, prevCount }))
      dispatch(setError("Failed to mark notifications as read. Please try again."))
    }
  }, [dispatch, items, unreadCount])

  const handleItemClick = useCallback(async (notification: Notification) => {
    const wasUnread = !notification.readAt
    dispatch(markRead(notification.id))
    try {
      await authenticatedFetch(`/api/notifications/${notification.id}/read`, { method: "POST" })
    } catch {
      // Roll back optimistic update on failure
      if (wasUnread) dispatch(revertMarkRead(notification.id))
    }
    // Navigate based on type + metadata — only allow safe internal paths (C1: open redirect fix)
    const meta = notification.metadata
    if (notification.type === "status_change" || notification.type === "document_request") {
      router.push("/customer/dashboard")
    } else if (isSafeInternalPath(meta.actionUrl)) {
      router.push(meta.actionUrl)
    } else {
      router.push("/notifications")
    }
  }, [dispatch, router])

  return (
    <Popover>
      <PopoverTrigger asChild onClick={loadNotifications}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              <Check className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-[360px]">
          {error && (
            <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-b border-destructive/20">
              {error}
            </div>
          )}
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <BellOff className="h-8 w-8 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={handleItemClick} />
              ))}
            </div>
          )}
        </ScrollArea>
        {items.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2">
              <Link
                href="/notifications"
                className="block text-center text-xs text-muted-foreground hover:text-foreground"
              >
                View all notifications
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
