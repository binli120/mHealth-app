/**
 * Unit tests for NotificationBell.
 * Tests the badge display logic and the polling/fetch-on-mount behaviour.
 * @author Bin Lee
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { configureStore } from "@reduxjs/toolkit"
import { Provider } from "react-redux"

import { notificationsReducer } from "@/lib/redux/features/notifications-slice"

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stub NotificationDropdown so we can test Bell in isolation
vi.mock("@/components/notifications/NotificationDropdown", () => ({
  NotificationDropdown: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-dropdown">{children}</div>
  ),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))

import { NotificationBell } from "@/components/notifications/NotificationBell"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStore(unreadCount = 0) {
  return configureStore({
    reducer: { notifications: notificationsReducer },
    preloadedState: {
      notifications: {
        items:       [],
        unreadCount,
        loading:     false,
        error:       null,
      },
    },
  })
}

function renderBell(unreadCount = 0) {
  const store = makeStore(unreadCount)
  render(
    <Provider store={store}>
      <NotificationBell />
    </Provider>,
  )
  return store
}

function mockUnreadResponse(count: number) {
  vi.mocked(authenticatedFetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ ok: true, data: { count } }),
  } as unknown as Response)
}

// ── Badge display ─────────────────────────────────────────────────────────────

describe("badge display", () => {
  beforeEach(() => {
    // Silent fetch — badge tests care only about store state, not API
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { count: 0 } }),
    } as unknown as Response)
  })

  it("shows no badge when unreadCount is 0", () => {
    renderBell(0)
    expect(screen.queryByText(/^\d+$|^9\+$/)).toBeNull()
  })

  it("shows the exact count badge when 1 ≤ unreadCount ≤ 9", () => {
    renderBell(3)
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("shows count '1' as a single digit (not '1+')", () => {
    renderBell(1)
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.queryByText("9+")).toBeNull()
  })

  it("shows '9' (not '9+') when count is exactly 9", () => {
    renderBell(9)
    expect(screen.getByText("9")).toBeInTheDocument()
    expect(screen.queryByText("9+")).toBeNull()
  })

  it("shows '9+' when unreadCount is 10", () => {
    renderBell(10)
    expect(screen.getByText("9+")).toBeInTheDocument()
  })

  it("shows '9+' when unreadCount is greater than 10", () => {
    renderBell(42)
    expect(screen.getByText("9+")).toBeInTheDocument()
  })
})

// ── Accessibility ─────────────────────────────────────────────────────────────

describe("accessibility", () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { count: 0 } }),
    } as unknown as Response)
  })

  it("renders a button with aria-label 'Notifications'", () => {
    renderBell()
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument()
  })

  it("wraps the button inside the NotificationDropdown", () => {
    renderBell()
    expect(screen.getByTestId("mock-dropdown")).toBeInTheDocument()
  })
})

// ── Fetch on mount ────────────────────────────────────────────────────────────

describe("fetch on mount", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls authenticatedFetch for the unread-count endpoint on mount", async () => {
    mockUnreadResponse(0)
    renderBell()
    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/notifications/unread-count",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
  })

  it("dispatches setUnreadCount with the API response value", async () => {
    mockUnreadResponse(7)
    const store = renderBell()
    await waitFor(() => {
      expect(store.getState().notifications.unreadCount).toBe(7)
    })
    // Badge should now be visible
    expect(screen.getByText("7")).toBeInTheDocument()
  })

  it("does not update unreadCount when the API returns ok: false", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: false }),
    } as unknown as Response)
    const store = renderBell(5)
    // Allow the promise to settle
    await act(async () => {})
    // Count should remain at the initial value (5), not overwritten
    expect(store.getState().notifications.unreadCount).toBe(5)
  })

  it("silently ignores network errors without crashing", async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error("Network error"))
    expect(() => renderBell()).not.toThrow()
    await act(async () => {})
    // No unhandled rejection — component stays mounted
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument()
  })
})

// ── Polling interval ──────────────────────────────────────────────────────────

describe("polling interval", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it("does not make a second fetch before the 15s interval elapses", async () => {
    mockUnreadResponse(0)
    renderBell()
    // Settle the initial call
    await act(async () => { await Promise.resolve() })
    vi.clearAllMocks()
    // Advance by 14 seconds — should NOT trigger another fetch
    await act(async () => { vi.advanceTimersByTime(14_000) })
    expect(authenticatedFetch).not.toHaveBeenCalled()
  })

  it("makes a second fetch after the 15s interval", async () => {
    mockUnreadResponse(2)
    renderBell()
    await act(async () => { await Promise.resolve() })
    vi.clearAllMocks()
    mockUnreadResponse(4)
    await act(async () => { vi.advanceTimersByTime(15_000) })
    await act(async () => { await Promise.resolve() })
    expect(authenticatedFetch).toHaveBeenCalledOnce()
  })

  it("backs off polling for one minute after a failed request", async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error("Network error"))
    renderBell()
    await act(async () => { await Promise.resolve() })
    vi.clearAllMocks()

    await act(async () => { vi.advanceTimersByTime(15_000) })
    await act(async () => { await Promise.resolve() })
    expect(authenticatedFetch).not.toHaveBeenCalled()

    await act(async () => { vi.advanceTimersByTime(45_000) })
    await act(async () => { await Promise.resolve() })
    expect(authenticatedFetch).toHaveBeenCalledOnce()
  })
})

// ── Cleanup on unmount ────────────────────────────────────────────────────────

describe("cleanup on unmount", () => {
  it("does not throw or dispatch after unmount", async () => {
    mockUnreadResponse(0)
    const store = makeStore()
    const { unmount } = render(
      <Provider store={store}>
        <NotificationBell />
      </Provider>,
    )
    unmount()
    // Allow any pending microtasks
    await act(async () => {})
    // No errors thrown
  })
})
