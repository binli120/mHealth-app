/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockSignOut = vi.fn().mockResolvedValue({})
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { useIdleTimeout } from "@/hooks/use-idle-timeout"

// ── Test constants ────────────────────────────────────────────────────────────

/** Short durations so tests stay fast. */
const IDLE_MS = 10_000    // 10 s
const WARNING_MS = 2_000  // 2 s  (warning fires at 8 s)

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderIdleHook() {
  return renderHook(() =>
    useIdleTimeout({ idleMs: IDLE_MS, warningMs: WARNING_MS }),
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("hooks/use-idle-timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReplace.mockClear()
    mockSignOut.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts with isWarning=false and full secondsRemaining", () => {
    const { result } = renderIdleHook()
    expect(result.current.isWarning).toBe(false)
    expect(result.current.secondsRemaining).toBe(WARNING_MS / 1000)
  })

  // ── Warning phase ──────────────────────────────────────────────────────────

  it("sets isWarning=true after (idleMs - warningMs) of inactivity", () => {
    const { result } = renderIdleHook()

    act(() => vi.advanceTimersByTime(IDLE_MS - WARNING_MS))

    expect(result.current.isWarning).toBe(true)
  })

  it("counts down secondsRemaining once warning is active", () => {
    const { result } = renderIdleHook()

    // Advance to the warning threshold
    act(() => vi.advanceTimersByTime(IDLE_MS - WARNING_MS))
    expect(result.current.isWarning).toBe(true)

    // Advance 1 second into the warning window
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current.secondsRemaining).toBeLessThan(WARNING_MS / 1000)
  })

  // ── Auto sign-out ──────────────────────────────────────────────────────────

  it("calls signOut and router.replace('/') after full idleMs", async () => {
    renderIdleHook()

    await act(async () => {
      vi.advanceTimersByTime(IDLE_MS)
      // Let the async signOut promise settle
      await Promise.resolve()
    })

    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(mockReplace).toHaveBeenCalledWith("/")
  })

  it("does not sign out before idleMs has elapsed", () => {
    renderIdleHook()

    act(() => vi.advanceTimersByTime(IDLE_MS - 1))

    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  // ── resetTimer ─────────────────────────────────────────────────────────────

  it("resetTimer dismisses the warning and restores full secondsRemaining", () => {
    const { result } = renderIdleHook()

    // Trigger warning
    act(() => vi.advanceTimersByTime(IDLE_MS - WARNING_MS))
    expect(result.current.isWarning).toBe(true)

    // User clicks "Stay signed in"
    act(() => result.current.resetTimer())

    expect(result.current.isWarning).toBe(false)
    expect(result.current.secondsRemaining).toBe(WARNING_MS / 1000)
  })

  it("resetTimer restarts the full idle window — logout does not fire at the old deadline", async () => {
    const { result } = renderIdleHook()

    // Advance close to (but not past) the sign-out deadline
    act(() => vi.advanceTimersByTime(IDLE_MS - 500))

    // Reset the timer before logout fires
    act(() => result.current.resetTimer())

    // Advance to what would have been the original logout time
    act(() => vi.advanceTimersByTime(500))

    // signOut must NOT have been called — the timer was restarted
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it("signs out at the NEW deadline after resetTimer", async () => {
    const { result } = renderIdleHook()

    // Partially advance, then reset
    act(() => vi.advanceTimersByTime(IDLE_MS - WARNING_MS))
    act(() => result.current.resetTimer())

    // Now advance the full idle window from the reset point
    await act(async () => {
      vi.advanceTimersByTime(IDLE_MS)
      await Promise.resolve()
    })

    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(mockReplace).toHaveBeenCalledWith("/")
  })

  // ── Cleanup ────────────────────────────────────────────────────────────────

  it("clears all timers on unmount — no sign-out fires after unmount", async () => {
    const { unmount } = renderIdleHook()

    act(() => unmount())

    await act(async () => {
      vi.advanceTimersByTime(IDLE_MS * 2)
      await Promise.resolve()
    })

    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  // ── Activity events ────────────────────────────────────────────────────────

  it("user activity before warning window resets the idle timer", async () => {
    renderIdleHook()

    // Almost to the warning threshold — fire a mouse event to reset
    act(() => vi.advanceTimersByTime(IDLE_MS - WARNING_MS - 100))
    act(() => window.dispatchEvent(new MouseEvent("mousemove")))

    // Now the idle timer has restarted; advance a full IDLE_MS — no logout yet
    // because the second timer hasn't expired (we only advance another IDLE_MS - 1)
    act(() => vi.advanceTimersByTime(IDLE_MS - 1))

    expect(mockSignOut).not.toHaveBeenCalled()
  })
})
