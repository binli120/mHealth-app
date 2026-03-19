"use client"

import { useCallback, useEffect, useRef } from "react"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { setUnreadCount } from "@/lib/redux/features/notifications-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

const POLL_INTERVAL_MS = 60_000
const VISIBILITY_DEBOUNCE_MS = 300

export function NotificationBell() {
  const dispatch = useAppDispatch()
  const unreadCount = useAppSelector((s) => s.notifications.unreadCount)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track in-flight request so setInterval never stacks concurrent calls
  const fetchingRef = useRef(false)
  const visibilityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUnreadCount = useCallback(async (signal?: AbortSignal) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await authenticatedFetch("/api/notifications/unread-count", { signal })
      if (signal?.aborted) return
      const json = await res.json() as { ok: boolean; data: { count: number } }
      if (json.ok) dispatch(setUnreadCount(json.data.count))
    } catch {
      // Non-critical — don't surface to user
    } finally {
      fetchingRef.current = false
    }
  }, [dispatch])

  useEffect(() => {
    const controller = new AbortController()

    fetchUnreadCount(controller.signal)

    // Use the controller signal so in-flight requests abort on unmount
    intervalRef.current = setInterval(() => fetchUnreadCount(controller.signal), POLL_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      // Debounce rapid tab-switch events
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current)
      visibilityDebounceRef.current = setTimeout(() => {
        fetchUnreadCount(controller.signal)
      }, VISIBILITY_DEBOUNCE_MS)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchUnreadCount])

  return (
    <NotificationDropdown>
      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
    </NotificationDropdown>
  )
}
