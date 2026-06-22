/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useEffect, useMemo, useRef } from "react"
import { usePathname } from "next/navigation"

const HEARTBEAT_INTERVAL_MS = 30_000
const SESSION_STORAGE_KEY = "hc_customer_analytics_session_id"

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getSessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) return existing

  const next = createSessionId()
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, next)
  return next
}

function postAnalytics(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/session", new Blob([body], { type: "application/json" }))
    return
  }

  void fetch("/api/analytics/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined)
}

export function CustomerSessionProvider() {
  const pathname = usePathname()
  const sessionId = useMemo(() => getSessionId(), [])
  const activeStartedAtRef = useRef<number | null>(null)
  const currentPathRef = useRef(pathname)

  useEffect(() => {
    currentPathRef.current = pathname
    postAnalytics({
      eventType: "page_view",
      path: pathname,
      sessionId,
    })
  }, [pathname, sessionId])

  useEffect(() => {
    function startActiveWindow() {
      if (document.visibilityState !== "visible") return
      activeStartedAtRef.current ??= Date.now()
    }

    function flushActiveWindow() {
      const startedAt = activeStartedAtRef.current
      activeStartedAtRef.current = document.visibilityState === "visible" ? Date.now() : null
      if (!startedAt) return

      const durationMs = Date.now() - startedAt
      if (durationMs <= 0) return

      postAnalytics({
        eventType: "active_time",
        durationMs,
        path: currentPathRef.current,
        sessionId,
      })
    }

    startActiveWindow()
    const intervalId = window.setInterval(flushActiveWindow, HEARTBEAT_INTERVAL_MS)

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        startActiveWindow()
      } else {
        flushActiveWindow()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", flushActiveWindow)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", flushActiveWindow)
      flushActiveWindow()
    }
  }, [sessionId])

  return null
}
