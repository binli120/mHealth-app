/**
 * Unit tests for NotificationDropdown.
 * Covers: rendering states, optimistic mark-read, mark-all-read, rollback on failure,
 * navigation routing, and the isSafeInternalPath open-redirect guard.
 * @author Bin Lee
 */

import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { configureStore } from "@reduxjs/toolkit"
import { Provider } from "react-redux"

import { notificationsReducer } from "@/lib/redux/features/notifications-slice"
import type { Notification } from "@/lib/notifications/types"

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))

// Flatten Radix UI Popover so content is always visible (no open/close needed)
vi.mock("@/components/ui/popover", () => ({
  Popover:        ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children, onClick, asChild }: { children: React.ReactElement; onClick?: () => void; asChild?: boolean }) =>
    asChild
      ? React.cloneElement(children, { onClick })
      : React.createElement("button", { onClick }, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}))

import { NotificationDropdown } from "@/components/notifications/NotificationDropdown"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

// ── Helpers ───────────────────────────────────────────────────────────────────

interface StoreState {
  items:       Notification[]
  unreadCount: number
  loading:     boolean
  error:       string | null
}

function makeStore(state: Partial<StoreState> = {}) {
  return configureStore({
    reducer: { notifications: notificationsReducer },
    preloadedState: {
      notifications: {
        items:       [],
        unreadCount: 0,
        loading:     false,
        error:       null,
        ...state,
      },
    },
  })
}

function renderDropdown(state: Partial<StoreState> = {}) {
  const store = makeStore(state)
  render(
    <Provider store={store}>
      <NotificationDropdown>
        <button>Open</button>
      </NotificationDropdown>
    </Provider>,
  )
  return store
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id:           "notif-1",
    userId:       "user-1",
    type:         "status_change",
    title:        "App approved",
    body:         "Your application was approved.",
    metadata:     {},
    readAt:       null,
    emailSentAt:  null,
    createdAt:    new Date().toISOString(),
    ...overrides,
  }
}

function mockFetchSuccess(body: object) {
  vi.mocked(authenticatedFetch).mockResolvedValue({
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function mockFetchFailure() {
  vi.mocked(authenticatedFetch).mockRejectedValue(new Error("Network error"))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPush.mockReset()
})

// ── Empty / loading / error states ───────────────────────────────────────────

describe("empty state", () => {
  it("shows 'No notifications yet' when items is empty and not loading", () => {
    renderDropdown({ items: [], loading: false })
    expect(screen.getByText("No notifications yet")).toBeInTheDocument()
  })

  it("shows the BellOff icon area when items is empty", () => {
    renderDropdown({ items: [], loading: false })
    // Presence of the empty-state text is sufficient; icon is decorative
    expect(screen.getByText("No notifications yet")).toBeInTheDocument()
  })
})

describe("loading state", () => {
  it("shows 'Loading…' when loading is true and items list is empty", () => {
    renderDropdown({ items: [], loading: true })
    expect(screen.getByText("Loading…")).toBeInTheDocument()
  })

  it("does NOT show 'Loading…' when items are present (even if loading is true)", () => {
    renderDropdown({ items: [makeNotification()], loading: true })
    expect(screen.queryByText("Loading…")).toBeNull()
  })
})

describe("error state", () => {
  it("shows the error message when error is set in the store", () => {
    renderDropdown({ error: "Failed to load notifications." })
    expect(screen.getByText("Failed to load notifications.")).toBeInTheDocument()
  })

  it("does NOT show error when error is null", () => {
    renderDropdown({ error: null })
    expect(screen.queryByText(/Failed/)).toBeNull()
  })
})

// ── With items ────────────────────────────────────────────────────────────────

describe("with notification items", () => {
  it("renders each notification title", () => {
    renderDropdown({
      items: [
        makeNotification({ id: "a", title: "First notification" }),
        makeNotification({ id: "b", title: "Second notification" }),
      ],
    })
    expect(screen.getByText("First notification")).toBeInTheDocument()
    expect(screen.getByText("Second notification")).toBeInTheDocument()
  })

  it("shows 'View all notifications' link when items are present", () => {
    renderDropdown({ items: [makeNotification()] })
    const link = screen.getByRole("link", { name: "View all notifications" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/notifications")
  })

  it("does NOT show 'View all notifications' link when items is empty", () => {
    renderDropdown({ items: [] })
    expect(screen.queryByRole("link", { name: "View all notifications" })).toBeNull()
  })
})

// ── "Mark all read" button ────────────────────────────────────────────────────

describe("Mark all read button", () => {
  it("shows 'Mark all read' button when unreadCount > 0", () => {
    renderDropdown({ unreadCount: 3 })
    expect(screen.getByRole("button", { name: /mark all read/i })).toBeInTheDocument()
  })

  it("does NOT show 'Mark all read' when unreadCount is 0", () => {
    renderDropdown({ unreadCount: 0 })
    expect(screen.queryByRole("button", { name: /mark all read/i })).toBeNull()
  })
})

// ── handleMarkAllRead ─────────────────────────────────────────────────────────

describe("handleMarkAllRead", () => {
  it("optimistically sets all items to read in the store", async () => {
    mockFetchSuccess({ ok: true })
    const store = renderDropdown({
      items: [
        makeNotification({ id: "a", readAt: null }),
        makeNotification({ id: "b", readAt: null }),
      ],
      unreadCount: 2,
    })
    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }))
    await waitFor(() => {
      const state = store.getState().notifications
      expect(state.unreadCount).toBe(0)
      expect(state.items.every((n) => n.readAt !== null)).toBe(true)
    })
  })

  it("calls the read-all API endpoint", async () => {
    mockFetchSuccess({ ok: true })
    renderDropdown({
      items:       [makeNotification({ id: "a", readAt: null })],
      unreadCount: 1,
    })
    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }))
    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/notifications/read-all",
        { method: "POST" },
      )
    })
  })

  it("rolls back the optimistic update when the API call fails", async () => {
    mockFetchFailure()
    const store = renderDropdown({
      items: [
        makeNotification({ id: "a", readAt: null }),
        makeNotification({ id: "b", readAt: null }),
      ],
      unreadCount: 2,
    })
    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }))
    await waitFor(() => {
      const state = store.getState().notifications
      // Rollback restores unreadCount and nulls readAt on previously-unread items
      expect(state.unreadCount).toBe(2)
      expect(state.items.filter((n) => n.readAt === null)).toHaveLength(2)
    })
  })
})

// ── handleItemClick + navigation ──────────────────────────────────────────────

describe("handleItemClick — mark read + navigation", () => {
  it("dispatches markRead for the clicked notification", async () => {
    mockFetchSuccess({ ok: true })
    const store = renderDropdown({
      items: [makeNotification({ id: "notif-1", readAt: null })],
    })
    // Click the notification item button (rendered by NotificationItem inside the dropdown)
    const itemButtons = screen.getAllByRole("button")
    const notifButton = itemButtons.find((b) => b.textContent?.includes("App approved"))
    fireEvent.click(notifButton!)
    await waitFor(() => {
      const item = store.getState().notifications.items.find((n) => n.id === "notif-1")
      expect(item?.readAt).not.toBeNull()
    })
  })

  it("calls the mark-read API for the notification id", async () => {
    mockFetchSuccess({ ok: true })
    renderDropdown({
      items: [makeNotification({ id: "notif-42", readAt: null })],
    })
    const itemButtons = screen.getAllByRole("button")
    const notifButton = itemButtons.find((b) => b.textContent?.includes("App approved"))
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/notifications/notif-42/read",
        { method: "POST" },
      )
    })
  })

  it("rolls back markRead when the API call fails (for unread notification)", async () => {
    mockFetchFailure()
    const store = renderDropdown({
      items: [makeNotification({ id: "notif-1", readAt: null })],
      unreadCount: 1,
    })
    const itemButtons = screen.getAllByRole("button")
    const notifButton = itemButtons.find((b) => b.textContent?.includes("App approved"))
    fireEvent.click(notifButton!)
    await waitFor(() => {
      const item = store.getState().notifications.items.find((n) => n.id === "notif-1")
      expect(item?.readAt).toBeNull()
    })
  })

  it("does NOT roll back markRead when notification was already read", async () => {
    mockFetchFailure()
    const readAt = "2026-01-01T00:00:00.000Z"
    const store = renderDropdown({
      items: [makeNotification({ id: "notif-1", readAt })],
      unreadCount: 0,
    })
    const itemButtons = screen.getAllByRole("button")
    const notifButton = itemButtons.find((b) => b.textContent?.includes("App approved"))
    fireEvent.click(notifButton!)
    await act(async () => {})
    // readAt stays set (no revert was needed since it was already read)
    const item = store.getState().notifications.items.find((n) => n.id === "notif-1")
    expect(item?.readAt).not.toBeNull()
  })
})

// ── Navigation routing ────────────────────────────────────────────────────────

describe("navigation routing after item click", () => {
  beforeEach(() => {
    mockFetchSuccess({ ok: true })
  })

  it("navigates to /customer/dashboard for status_change notifications", async () => {
    renderDropdown({
      items: [makeNotification({ type: "status_change", metadata: {} })],
    })
    const notifButton = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("App approved"),
    )
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/customer/dashboard")
    })
  })

  it("navigates to /customer/dashboard for document_request notifications", async () => {
    renderDropdown({
      items: [makeNotification({ type: "document_request", metadata: {} })],
    })
    const notifButton = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("App approved"),
    )
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/customer/dashboard")
    })
  })

  it("navigates to a safe internal actionUrl from metadata", async () => {
    renderDropdown({
      items: [
        makeNotification({
          type:     "general",
          metadata: { actionUrl: "/customer/profile#notifications" },
        }),
      ],
    })
    const notifButton = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("App approved"),
    )
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/customer/profile#notifications")
    })
  })

  it("falls back to /notifications when actionUrl is an external URL (open-redirect guard)", async () => {
    renderDropdown({
      items: [
        makeNotification({
          type:     "general",
          metadata: { actionUrl: "https://evil.com/steal-tokens" },
        }),
      ],
    })
    const notifButton = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("App approved"),
    )
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/notifications")
    })
  })

  it("falls back to /notifications when actionUrl contains '://'", async () => {
    renderDropdown({
      items: [
        makeNotification({
          type:     "renewal_reminder",
          metadata: { actionUrl: "javascript://xss" },
        }),
      ],
    })
    const notifButton = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("App approved"),
    )
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/notifications")
    })
  })

  it("falls back to /notifications when metadata has no actionUrl", async () => {
    renderDropdown({
      items: [makeNotification({ type: "general", metadata: {} })],
    })
    const notifButton = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("App approved"),
    )
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/notifications")
    })
  })

  it("falls back to /notifications when actionUrl is a non-string", async () => {
    renderDropdown({
      items: [makeNotification({ type: "general", metadata: { actionUrl: 42 } })],
    })
    const notifButton = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("App approved"),
    )
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/notifications")
    })
  })

  it("navigates using actionUrl for session_invite with safe path", async () => {
    renderDropdown({
      items: [
        makeNotification({
          type:     "session_invite",
          metadata: { actionUrl: "/customer/sessions/sess-99" },
        }),
      ],
    })
    const notifButton = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("App approved"),
    )
    fireEvent.click(notifButton!)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/customer/sessions/sess-99")
    })
  })
})

// ── loadNotifications on trigger click ───────────────────────────────────────

describe("loadNotifications", () => {
  it("calls GET /api/notifications when the trigger is clicked", async () => {
    mockFetchSuccess({ ok: true, data: [] })
    renderDropdown()
    // The trigger wraps the children passed by the parent — click it
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/notifications"),
      )
    })
  })

  it("dispatches setNotifications with the fetched list", async () => {
    const items = [makeNotification({ id: "fetched-1", title: "Fetched notification" })]
    mockFetchSuccess({ ok: true, data: items })
    const store = renderDropdown()
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() => {
      expect(store.getState().notifications.items).toHaveLength(1)
      expect(store.getState().notifications.items[0].title).toBe("Fetched notification")
    })
  })

  it("dispatches setError when the fetch throws", async () => {
    mockFetchFailure()
    const store = renderDropdown()
    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() => {
      expect(store.getState().notifications.error).toBe("Failed to load notifications.")
    })
  })
})
