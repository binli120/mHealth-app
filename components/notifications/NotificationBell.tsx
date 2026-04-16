/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useRef } from "react"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { setUnreadCount } from "@/lib/redux/features/notifications-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

const POLL_INTERVAL_MS = 15_000
const POLL_RETRY_MS = 60_000
const VISIBILITY_DEBOUNCE_MS = 300
/** Custom event dispatched by chat panels when new messages arrive. */
const NOTIFICATION_REFRESH_EVENT = "notification:refresh"

export function NotificationBell() {
  const dispatch = useAppDispatch()
  const unreadCount = useAppSelector((s) => s.notifications.unreadCount)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track in-flight request so setInterval never stacks concurrent calls
  const fetchingRef = useRef(false)
  const nextAllowedPollAtRef = useRef(0)
  const visibilityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUnreadCount = useCallback(async (signal?: AbortSignal, force = false) => {
    if (signal?.aborted) return
    if (document.visibilityState !== "visible") return
    if (typeof navigator !== "undefined" && !navigator.onLine) return

    const now = Date.now()
    if (!force && now < nextAllowedPollAtRef.current) return
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      const res = await authenticatedFetch("/api/notifications/unread-count", { signal })
      if (signal?.aborted) return
      if (!res.ok) {
        nextAllowedPollAtRef.current = Date.now() + POLL_RETRY_MS
        return
      }
      const json = await res.json() as { ok: boolean; data: { count: number } }
      if (json.ok) {
        nextAllowedPollAtRef.current = 0
        dispatch(setUnreadCount(json.data.count))
        return
      }

      nextAllowedPollAtRef.current = Date.now() + POLL_RETRY_MS
    } catch {
      nextAllowedPollAtRef.current = Date.now() + POLL_RETRY_MS
    } finally {
      fetchingRef.current = false
    }
  }, [dispatch])

  useEffect(() => {
    const controller = new AbortController()

    void fetchUnreadCount(controller.signal)

    // Use the controller signal so in-flight requests abort on unmount
    intervalRef.current = setInterval(() => { void fetchUnreadCount(controller.signal) }, POLL_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      // Debounce rapid tab-switch events
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current)
      visibilityDebounceRef.current = setTimeout(() => {
        void fetchUnreadCount(controller.signal, true)
      }, VISIBILITY_DEBOUNCE_MS)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Refresh immediately when a chat panel signals new messages arrived
    const handleNotificationRefresh = () => { void fetchUnreadCount(controller.signal, true) }
    const handleOnline = () => { void fetchUnreadCount(controller.signal, true) }
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, handleNotificationRefresh)
    window.addEventListener("online", handleOnline)

    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener(NOTIFICATION_REFRESH_EVENT, handleNotificationRefresh)
      window.removeEventListener("online", handleOnline)
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
