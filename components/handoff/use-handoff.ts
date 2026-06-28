"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSupabaseClient } from "@/lib/supabase/client"
import type { HandoffContextType } from "@/lib/db/mobile-handoff-session"

export type HandoffState = "idle" | "creating" | "waiting_scan" | "in_progress" | "completed" | "error"

export function useHandoff(
  contextType: HandoffContextType,
  getPayload: () => Record<string, unknown>,
  onComplete?: (progressSummary: Record<string, unknown>) => void,
) {
  const [state, setState] = useState<HandoffState>("idle")
  const [mobileUrl, setMobileUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const trigger = useCallback(async () => {
    setState("creating")
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      const refreshToken = data.session?.refresh_token
      if (!refreshToken) throw new Error("No active session")

      const res = await authenticatedFetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextType, contextPayload: getPayload(), refreshToken }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)

      setToken(json.token)
      setMobileUrl(json.mobileUrl)
      setExpiresAt(new Date(json.expiresAt))
      setState("waiting_scan")
    } catch {
      setState("error")
    }
  }, [contextType, getPayload])

  const cancel = useCallback(async () => {
    stopPolling()
    if (token) {
      await authenticatedFetch(`/api/handoff?token=${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => {})
    }
    setState("idle")
    setToken(null)
    setMobileUrl(null)
    setExpiresAt(null)
  }, [token, stopPolling])

  // Start polling when we have a token
  useEffect(() => {
    if (!token || state === "idle" || state === "completed" || state === "error") return
    pollRef.current = setInterval(async () => {
      try {
        const res = await authenticatedFetch(`/api/handoff?token=${encodeURIComponent(token)}`)
        const json = await res.json()
        if (!json.ok) return
        if (json.status === "active" && state === "waiting_scan") setState("in_progress")
        if (json.status === "completed") {
          stopPolling()
          setState("completed")
          onComplete?.(json.progressSummary ?? {})
          setTimeout(() => setState("idle"), 3000)
        }
        if (json.status === "expired") { stopPolling(); setState("idle") }
      } catch { /* ignore poll errors */ }
    }, 3000)
    return stopPolling
  }, [token, state, stopPolling, onComplete])

  return { trigger, cancel, state, mobileUrl, expiresAt }
}
