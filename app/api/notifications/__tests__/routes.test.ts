/**
 * Unit tests for all four notification API routes.
 *   GET  /api/notifications           — list
 *   GET  /api/notifications/unread-count
 *   POST /api/notifications/[id]/read
 *   POST /api/notifications/read-all
 *
 * DB and auth are mocked; only the route handler logic is exercised.
 * @author Bin Lee
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Notification } from "@/lib/notifications/types"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db/notifications", () => ({
  getNotifications: vi.fn(),
  getUnreadCount:   vi.fn(),
  markAsRead:       vi.fn(),
  markAllAsRead:    vi.fn(),
}))

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { GET as listGET }        from "@/app/api/notifications/route"
import { GET as unreadGET }      from "@/app/api/notifications/unread-count/route"
import { POST as markReadPOST }  from "@/app/api/notifications/[id]/read/route"
import { POST as markAllPOST }   from "@/app/api/notifications/read-all/route"

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/lib/db/notifications"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

// ── Test helpers ──────────────────────────────────────────────────────────────

const USER_ID = "user-abc"

function mockAuth() {
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
}

function mockAuthFail() {
  const res = new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 })
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: false, response: res } as never)
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id:           "notif-1",
    userId:       USER_ID,
    type:         "status_change",
    title:        "Test notification",
    body:         "Test body",
    metadata:     {},
    readAt:       null,
    emailSentAt:  null,
    createdAt:    "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeRequest(url: string, method = "GET") {
  return new Request(`http://localhost${url}`, { method })
}

beforeEach(() => { vi.clearAllMocks() })

// ── GET /api/notifications ────────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuthFail()
    const res = await listGET(makeRequest("/api/notifications"))
    expect(res.status).toBe(401)
  })

  it("returns 200 with the notifications array", async () => {
    mockAuth()
    const items = [makeNotification({ id: "a" }), makeNotification({ id: "b" })]
    vi.mocked(getNotifications).mockResolvedValue(items)

    const res = await listGET(makeRequest("/api/notifications"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data).toHaveLength(2)
  })

  it("defaults limit to 50 when not specified", async () => {
    mockAuth()
    vi.mocked(getNotifications).mockResolvedValue([])

    await listGET(makeRequest("/api/notifications"))

    expect(getNotifications).toHaveBeenCalledWith(USER_ID, 50)
  })

  it("passes the requested limit to getNotifications", async () => {
    mockAuth()
    vi.mocked(getNotifications).mockResolvedValue([])

    await listGET(makeRequest("/api/notifications?limit=10"))

    expect(getNotifications).toHaveBeenCalledWith(USER_ID, 10)
  })

  it("clamps limit to 100 when a larger value is requested", async () => {
    mockAuth()
    vi.mocked(getNotifications).mockResolvedValue([])

    await listGET(makeRequest("/api/notifications?limit=999"))

    expect(getNotifications).toHaveBeenCalledWith(USER_ID, 100)
  })

  it("falls back to 50 when limit is NaN or negative", async () => {
    mockAuth()
    vi.mocked(getNotifications).mockResolvedValue([])

    await listGET(makeRequest("/api/notifications?limit=abc"))
    expect(getNotifications).toHaveBeenCalledWith(USER_ID, 50)

    vi.clearAllMocks()
    mockAuth()
    vi.mocked(getNotifications).mockResolvedValue([])

    await listGET(makeRequest("/api/notifications?limit=-1"))
    expect(getNotifications).toHaveBeenCalledWith(USER_ID, 50)
  })

  it("returns 500 when getNotifications throws", async () => {
    mockAuth()
    vi.mocked(getNotifications).mockRejectedValue(new Error("DB down"))

    const res = await listGET(makeRequest("/api/notifications"))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.ok).toBe(false)
  })
})

// ── GET /api/notifications/unread-count ──────────────────────────────────────

describe("GET /api/notifications/unread-count", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuthFail()
    const res = await unreadGET(makeRequest("/api/notifications/unread-count"))
    expect(res.status).toBe(401)
  })

  it("returns 200 with the unread count", async () => {
    mockAuth()
    vi.mocked(getUnreadCount).mockResolvedValue(5)

    const res = await unreadGET(makeRequest("/api/notifications/unread-count"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data.count).toBe(5)
  })

  it("returns count of 0 when all notifications are read", async () => {
    mockAuth()
    vi.mocked(getUnreadCount).mockResolvedValue(0)

    const res = await unreadGET(makeRequest("/api/notifications/unread-count"))
    const json = await res.json()

    expect(json.data.count).toBe(0)
  })

  it("returns 500 when getUnreadCount throws", async () => {
    mockAuth()
    vi.mocked(getUnreadCount).mockRejectedValue(new Error("DB unavailable"))

    const res = await unreadGET(makeRequest("/api/notifications/unread-count"))
    expect(res.status).toBe(500)
  })
})

// ── POST /api/notifications/[id]/read ────────────────────────────────────────

describe("POST /api/notifications/[id]/read", () => {
  const params = { params: Promise.resolve({ id: "notif-42" }) }

  it("returns 401 when not authenticated", async () => {
    mockAuthFail()
    const res = await markReadPOST(makeRequest("/api/notifications/notif-42/read", "POST"), params)
    expect(res.status).toBe(401)
  })

  it("calls markAsRead with the notification id and the caller's userId", async () => {
    mockAuth()
    vi.mocked(markAsRead).mockResolvedValue(undefined)

    const res = await markReadPOST(makeRequest("/api/notifications/notif-42/read", "POST"), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(markAsRead).toHaveBeenCalledWith("notif-42", USER_ID)
  })

  it("returns 500 when markAsRead throws", async () => {
    mockAuth()
    vi.mocked(markAsRead).mockRejectedValue(new Error("lock timeout"))

    const res = await markReadPOST(makeRequest("/api/notifications/notif-42/read", "POST"), params)
    expect(res.status).toBe(500)
  })

  it("uses the id from params, not from the URL", async () => {
    mockAuth()
    vi.mocked(markAsRead).mockResolvedValue(undefined)

    const differentParams = { params: Promise.resolve({ id: "notif-99" }) }
    await markReadPOST(makeRequest("/api/notifications/notif-42/read", "POST"), differentParams)

    expect(markAsRead).toHaveBeenCalledWith("notif-99", USER_ID)
  })
})

// ── POST /api/notifications/read-all ─────────────────────────────────────────

describe("POST /api/notifications/read-all", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuthFail()
    const res = await markAllPOST(makeRequest("/api/notifications/read-all", "POST"))
    expect(res.status).toBe(401)
  })

  it("calls markAllAsRead with the caller's userId", async () => {
    mockAuth()
    vi.mocked(markAllAsRead).mockResolvedValue(undefined)

    const res = await markAllPOST(makeRequest("/api/notifications/read-all", "POST"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(markAllAsRead).toHaveBeenCalledWith(USER_ID)
  })

  it("returns 500 when markAllAsRead throws", async () => {
    mockAuth()
    vi.mocked(markAllAsRead).mockRejectedValue(new Error("connection error"))

    const res = await markAllPOST(makeRequest("/api/notifications/read-all", "POST"))
    expect(res.status).toBe(500)
  })
})
