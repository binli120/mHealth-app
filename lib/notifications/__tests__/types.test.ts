/**
 * Unit tests for rowToNotification — the DB-row → client-shape transformer.
 * Pure function, zero mocks required.
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import { rowToNotification } from "@/lib/notifications/types"
import type { NotificationRow } from "@/lib/notifications/types"

function makeRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id:             "notif-1",
    user_id:        "user-abc",
    type:           "status_change",
    title:          "Application approved",
    body:           "Your application was approved.",
    metadata:       { applicationId: "app-1" },
    read_at:        null,
    email_sent_at:  null,
    created_at:     new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  }
}

describe("rowToNotification", () => {
  it("maps all scalar fields from snake_case to camelCase", () => {
    const row = makeRow()
    const n = rowToNotification(row)

    expect(n.id).toBe("notif-1")
    expect(n.userId).toBe("user-abc")
    expect(n.type).toBe("status_change")
    expect(n.title).toBe("Application approved")
    expect(n.body).toBe("Your application was approved.")
    expect(n.metadata).toEqual({ applicationId: "app-1" })
    expect(n.createdAt).toBe("2026-01-15T10:00:00.000Z")
  })

  it("sets readAt to null when read_at is null", () => {
    const n = rowToNotification(makeRow({ read_at: null }))
    expect(n.readAt).toBeNull()
  })

  it("converts a present read_at Date to an ISO string", () => {
    const readDate = new Date("2026-01-16T08:30:00Z")
    const n = rowToNotification(makeRow({ read_at: readDate }))
    expect(n.readAt).toBe("2026-01-16T08:30:00.000Z")
  })

  it("sets emailSentAt to null when email_sent_at is null", () => {
    const n = rowToNotification(makeRow({ email_sent_at: null }))
    expect(n.emailSentAt).toBeNull()
  })

  it("converts a present email_sent_at Date to an ISO string", () => {
    const sentDate = new Date("2026-01-15T10:05:00Z")
    const n = rowToNotification(makeRow({ email_sent_at: sentDate }))
    expect(n.emailSentAt).toBe("2026-01-15T10:05:00.000Z")
  })

  it("falls back to an empty object when metadata is null/undefined", () => {
    // Simulate a DB row that came back with a null metadata column
    const row = makeRow({ metadata: null as unknown as Record<string, unknown> })
    const n = rowToNotification(row)
    expect(n.metadata).toEqual({})
  })

  it("preserves non-trivial metadata", () => {
    const meta = { applicationId: "x", documentType: "W-2", dueDate: "2026-02-01" }
    const n = rowToNotification(makeRow({ metadata: meta }))
    expect(n.metadata).toEqual(meta)
  })

  it("handles every NotificationType without throwing", () => {
    const types = [
      "status_change",
      "document_request",
      "renewal_reminder",
      "deadline",
      "general",
      "session_invite",
      "session_starting",
    ] as const

    for (const type of types) {
      expect(() => rowToNotification(makeRow({ type }))).not.toThrow()
    }
  })
})
