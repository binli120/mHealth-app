/**
 * Unit tests for notificationsSlice reducers.
 * Pure Redux logic — no mocks required.
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import {
  notificationsReducer,
  setNotifications,
  setUnreadCount,
  markRead,
  markAllRead,
  revertMarkRead,
  revertMarkAllRead,
  setLoading,
  setError,
  type NotificationsState,
} from "@/lib/redux/features/notifications-slice"
import type { Notification } from "@/lib/notifications/types"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const emptyState: NotificationsState = notificationsReducer(undefined, { type: "@@INIT" })

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id:           "notif-1",
    userId:       "user-1",
    type:         "status_change",
    title:        "App approved",
    body:         "Congratulations!",
    metadata:     {},
    readAt:       null,
    emailSentAt:  null,
    createdAt:    "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

// ── setNotifications ──────────────────────────────────────────────────────────

describe("setNotifications", () => {
  it("replaces items with the provided list", () => {
    const n1 = makeNotification({ id: "a" })
    const n2 = makeNotification({ id: "b" })
    const state = notificationsReducer(emptyState, setNotifications([n1, n2]))
    expect(state.items).toHaveLength(2)
    expect(state.items[0].id).toBe("a")
  })

  it("auto-computes unreadCount from items with null readAt", () => {
    const unread1  = makeNotification({ id: "u1", readAt: null })
    const unread2  = makeNotification({ id: "u2", readAt: null })
    const alreadyRead = makeNotification({ id: "r1", readAt: "2026-01-01T00:00:00.000Z" })
    const state = notificationsReducer(emptyState, setNotifications([unread1, unread2, alreadyRead]))
    expect(state.unreadCount).toBe(2)
  })

  it("clears loading and error", () => {
    const dirty: NotificationsState = { ...emptyState, loading: true, error: "old error" }
    const state = notificationsReducer(dirty, setNotifications([]))
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it("sets unreadCount to 0 when all items are read", () => {
    const read1 = makeNotification({ id: "r1", readAt: "2026-01-02T00:00:00.000Z" })
    const read2 = makeNotification({ id: "r2", readAt: "2026-01-03T00:00:00.000Z" })
    const state = notificationsReducer(emptyState, setNotifications([read1, read2]))
    expect(state.unreadCount).toBe(0)
  })
})

// ── setUnreadCount ────────────────────────────────────────────────────────────

describe("setUnreadCount", () => {
  it("updates unreadCount independently from items", () => {
    const state = notificationsReducer(emptyState, setUnreadCount(7))
    expect(state.unreadCount).toBe(7)
  })

  it("allows setting to 0", () => {
    const s1 = notificationsReducer(emptyState, setUnreadCount(5))
    const s2 = notificationsReducer(s1, setUnreadCount(0))
    expect(s2.unreadCount).toBe(0)
  })
})

// ── markRead ──────────────────────────────────────────────────────────────────

describe("markRead", () => {
  it("sets readAt on the target item and decrements unreadCount", () => {
    const n = makeNotification({ id: "n1", readAt: null })
    const s1 = notificationsReducer(emptyState, setNotifications([n]))
    const s2 = notificationsReducer(s1, markRead("n1"))

    expect(s2.items[0].readAt).not.toBeNull()
    expect(s2.unreadCount).toBe(0)
  })

  it("is a no-op when the item is already read", () => {
    const n = makeNotification({ id: "n1", readAt: "2026-01-01T00:00:00.000Z" })
    const s1 = notificationsReducer(
      { ...emptyState, items: [n], unreadCount: 0 },
      markRead("n1"),
    )
    expect(s1.unreadCount).toBe(0)
    expect(s1.items[0].readAt).toBe("2026-01-01T00:00:00.000Z")
  })

  it("does not touch other items", () => {
    const n1 = makeNotification({ id: "n1", readAt: null })
    const n2 = makeNotification({ id: "n2", readAt: null })
    const s1 = notificationsReducer(emptyState, setNotifications([n1, n2]))
    const s2 = notificationsReducer(s1, markRead("n1"))
    expect(s2.items[1].readAt).toBeNull()
    expect(s2.unreadCount).toBe(1)
  })

  it("does not let unreadCount go below zero", () => {
    const n = makeNotification({ id: "n1", readAt: null })
    const s1 = { ...emptyState, items: [n], unreadCount: 0 } // already 0
    // Force-mark it unread so markRead fires
    const s2 = notificationsReducer(s1, markRead("n1"))
    // It won't decrement because item.readAt was null but unreadCount was 0
    // markRead stamps readAt then does Math.max(0, count-1)
    expect(s2.unreadCount).toBeGreaterThanOrEqual(0)
  })
})

// ── markAllRead ───────────────────────────────────────────────────────────────

describe("markAllRead", () => {
  it("stamps readAt on every unread item", () => {
    const items = [
      makeNotification({ id: "a", readAt: null }),
      makeNotification({ id: "b", readAt: null }),
      makeNotification({ id: "c", readAt: "2026-01-01T00:00:00.000Z" }),
    ]
    const s1 = notificationsReducer(emptyState, setNotifications(items))
    const s2 = notificationsReducer(s1, markAllRead())
    expect(s2.items.every((n) => n.readAt !== null)).toBe(true)
    expect(s2.unreadCount).toBe(0)
  })

  it("is safe when there are no unread items", () => {
    const items = [makeNotification({ id: "a", readAt: "2026-01-01T00:00:00.000Z" })]
    const s1 = notificationsReducer(emptyState, setNotifications(items))
    expect(() => notificationsReducer(s1, markAllRead())).not.toThrow()
    expect(notificationsReducer(s1, markAllRead()).unreadCount).toBe(0)
  })
})

// ── revertMarkRead ────────────────────────────────────────────────────────────

describe("revertMarkRead", () => {
  it("nulls readAt on the target item and increments unreadCount", () => {
    const n = makeNotification({ id: "n1", readAt: "2026-01-01T10:00:00.000Z" })
    const s1 = { ...emptyState, items: [n], unreadCount: 0 }
    const s2 = notificationsReducer(s1, revertMarkRead("n1"))

    expect(s2.items[0].readAt).toBeNull()
    expect(s2.unreadCount).toBe(1)
  })

  it("is a no-op when the item is already unread", () => {
    const n = makeNotification({ id: "n1", readAt: null })
    const s1 = { ...emptyState, items: [n], unreadCount: 1 }
    const s2 = notificationsReducer(s1, revertMarkRead("n1"))
    // readAt stays null, count unchanged
    expect(s2.items[0].readAt).toBeNull()
    expect(s2.unreadCount).toBe(1)
  })
})

// ── revertMarkAllRead ─────────────────────────────────────────────────────────

describe("revertMarkAllRead", () => {
  it("nulls readAt for listed ids and restores the previous count", () => {
    const items = [
      makeNotification({ id: "a", readAt: "2026-01-01T00:00:00.000Z" }),
      makeNotification({ id: "b", readAt: "2026-01-01T00:00:00.000Z" }),
      makeNotification({ id: "c", readAt: "2025-12-01T00:00:00.000Z" }),
    ]
    const s1 = { ...emptyState, items, unreadCount: 0 }
    const s2 = notificationsReducer(s1, revertMarkAllRead({ unreadIds: ["a", "b"], prevCount: 2 }))

    expect(s2.items.find((n) => n.id === "a")?.readAt).toBeNull()
    expect(s2.items.find((n) => n.id === "b")?.readAt).toBeNull()
    // "c" was already read before markAll — readAt preserved
    expect(s2.items.find((n) => n.id === "c")?.readAt).not.toBeNull()
    expect(s2.unreadCount).toBe(2)
  })
})

// ── setLoading ────────────────────────────────────────────────────────────────

describe("setLoading", () => {
  it("setLoading(true) sets loading and clears error", () => {
    const s1 = { ...emptyState, loading: false, error: "some error" }
    const s2 = notificationsReducer(s1, setLoading(true))
    expect(s2.loading).toBe(true)
    expect(s2.error).toBeNull()
  })

  it("setLoading(false) clears loading without touching error", () => {
    const s1 = { ...emptyState, loading: true, error: "existing error" }
    const s2 = notificationsReducer(s1, setLoading(false))
    expect(s2.loading).toBe(false)
    // setLoading(false) should NOT clear error — only setLoading(true) clears it
    expect(s2.error).toBe("existing error")
  })
})

// ── setError ──────────────────────────────────────────────────────────────────

describe("setError", () => {
  it("sets the error message and clears loading", () => {
    const s1 = { ...emptyState, loading: true }
    const s2 = notificationsReducer(s1, setError("Network failed"))
    expect(s2.error).toBe("Network failed")
    expect(s2.loading).toBe(false)
  })

  it("can clear the error by passing null", () => {
    const s1 = { ...emptyState, error: "old error" }
    const s2 = notificationsReducer(s1, setError(null))
    expect(s2.error).toBeNull()
  })
})
