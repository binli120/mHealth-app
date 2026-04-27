/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"

// ── Constants ─────────────────────────────────────────────────────────────────

/** Total inactivity window before sign-out (30 minutes). */
const DEFAULT_IDLE_MS = 30 * 60 * 1000

/** How early to show the "about to expire" warning (2 minutes before sign-out). */
const DEFAULT_WARNING_MS = 2 * 60 * 1000

/**
 * Browser events that count as "user is active".
 * Using a tuple literal so TS can narrow the event type for `addEventListener`.
 */
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const

type ActivityEvent = (typeof ACTIVITY_EVENTS)[number]

declare global {
  interface Window {
    __HEALTHCOMPASS_IDLE_TIMEOUT_MS__?: number
    __HEALTHCOMPASS_IDLE_WARNING_MS__?: number
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseIdleTimeoutOptions {
  /** Total idle window in ms. Defaults to 30 minutes. */
  idleMs?: number
  /** How many ms before sign-out to show the warning. Defaults to 2 minutes. */
  warningMs?: number
}

export interface UseIdleTimeoutResult {
  /** True once the remaining time has fallen below `warningMs`. */
  isWarning: boolean
  /** Whole seconds remaining until sign-out (only meaningful when `isWarning`). */
  secondsRemaining: number
  /** Call this to dismiss the warning and reset the full idle timer. */
  resetTimer: () => void
}

function getPositiveFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

function resolveIdleTiming(overrides: UseIdleTimeoutOptions): Required<UseIdleTimeoutOptions> {
  const browserIdleMs =
    process.env.NODE_ENV !== "production" && typeof window !== "undefined"
      ? getPositiveFiniteNumber(window.__HEALTHCOMPASS_IDLE_TIMEOUT_MS__)
      : null
  const browserWarningMs =
    process.env.NODE_ENV !== "production" && typeof window !== "undefined"
      ? getPositiveFiniteNumber(window.__HEALTHCOMPASS_IDLE_WARNING_MS__)
      : null

  const idleMs = overrides.idleMs ?? browserIdleMs ?? DEFAULT_IDLE_MS
  const warningMs = Math.min(overrides.warningMs ?? browserWarningMs ?? DEFAULT_WARNING_MS, idleMs)

  return { idleMs, warningMs }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Tracks user activity and automatically signs out + redirects to "/" after
 * `idleMs` of inactivity.  Shows a warning `warningMs` before that deadline.
 *
 * Drop `<IdleTimeoutGuard />` anywhere inside an authenticated layout to
 * activate; the guard renders the countdown dialog and wires up this hook.
 */
export function useIdleTimeout({
  idleMs: idleMsOverride,
  warningMs: warningMsOverride,
}: UseIdleTimeoutOptions = {}): UseIdleTimeoutResult {
  const router = useRouter()
  const { idleMs, warningMs } = resolveIdleTiming({
    idleMs: idleMsOverride,
    warningMs: warningMsOverride,
  })

  const [isWarning, setIsWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.round(warningMs / 1000),
  )

  // Mutable refs — never trigger re-renders
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningStartedAtRef = useRef<number>(0)

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const clearAllTimers = useCallback(() => {
    if (logoutTimerRef.current !== null) {
      clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
    if (warningTimerRef.current !== null) {
      clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  // ── Sign-out ───────────────────────────────────────────────────────────────

  const performLogout = useCallback(async () => {
    clearAllTimers()
    try {
      const supabase = getSupabaseClient()
      await supabase.auth.signOut()
    } catch {
      // Best-effort — if the sign-out call fails, redirect anyway so the user
      // ends up back at the public home page.
    }
    router.replace("/")
  }, [clearAllTimers, router])

  // ── Warning countdown ──────────────────────────────────────────────────────

  const startCountdown = useCallback(() => {
    warningStartedAtRef.current = Date.now()
    setSecondsRemaining(Math.round(warningMs / 1000))
    setIsWarning(true)

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - warningStartedAtRef.current
      const remaining = Math.max(0, Math.round((warningMs - elapsed) / 1000))
      setSecondsRemaining(remaining)
    }, 500) // 500ms polling keeps the display responsive
  }, [warningMs])

  // ── Reset (also called by user "Stay signed in") ───────────────────────────

  const resetTimer = useCallback(() => {
    clearAllTimers()
    setIsWarning(false)
    setSecondsRemaining(Math.round(warningMs / 1000))

    // Fire warning at (idleMs − warningMs)
    warningTimerRef.current = setTimeout(() => {
      startCountdown()
    }, idleMs - warningMs)

    // Fire logout at idleMs
    logoutTimerRef.current = setTimeout(() => {
      void performLogout()
    }, idleMs)
  }, [clearAllTimers, idleMs, warningMs, startCountdown, performLogout])

  // ── Mount: bind activity listeners and kick off initial timers ─────────────

  useEffect(() => {
    resetTimer()

    const handleActivity = () => {
      // Only reset if we're not already in the warning window — once the
      // countdown is running the user must explicitly click "Stay signed in".
      if (!isWarningRef.current) {
        resetTimer()
      }
    }

    ACTIVITY_EVENTS.forEach((ev: ActivityEvent) =>
      window.addEventListener(ev, handleActivity, { passive: true }),
    )

    return () => {
      clearAllTimers()
      ACTIVITY_EVENTS.forEach((ev: ActivityEvent) =>
        window.removeEventListener(ev, handleActivity),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally empty — resetTimer/clearAllTimers are stable after mount

  // Keep a ref that the event listener closure can read without going stale
  const isWarningRef = useRef(isWarning)
  useEffect(() => {
    isWarningRef.current = isWarning
  }, [isWarning])

  return { isWarning, secondsRemaining, resetTimer }
}
