/**
 * Unit tests for NotificationItem.
 * Pure render component — no Redux, no network calls.
 * @author Bin Lee
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NotificationItem } from "@/components/notifications/NotificationItem"
import type { Notification, NotificationType } from "@/lib/notifications/types"

// ── Fixture ───────────────────────────────────────────────────────────────────

const FROZEN_NOW = new Date("2026-03-24T12:00:00.000Z")

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id:           "notif-1",
    userId:       "user-1",
    type:         "status_change",
    title:        "Application approved",
    body:         "Your MassHealth application has been approved.",
    metadata:     {},
    readAt:       null,
    emailSentAt:  null,
    createdAt:    FROZEN_NOW.toISOString(),
    ...overrides,
  }
}

// ── Basic rendering ───────────────────────────────────────────────────────────

describe("basic rendering", () => {
  it("renders the notification title", () => {
    render(<NotificationItem notification={makeNotification()} />)
    expect(screen.getByText("Application approved")).toBeInTheDocument()
  })

  it("renders the notification body", () => {
    render(<NotificationItem notification={makeNotification()} />)
    expect(screen.getByText("Your MassHealth application has been approved.")).toBeInTheDocument()
  })

  it("renders as a <button> element", () => {
    render(<NotificationItem notification={makeNotification()} />)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })
})

// ── Read / unread visual state ────────────────────────────────────────────────

describe("read / unread state", () => {
  it("applies unread background class when readAt is null", () => {
    render(<NotificationItem notification={makeNotification({ readAt: null })} />)
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("bg-muted/30")
  })

  it("does NOT apply unread background class when readAt is set", () => {
    render(
      <NotificationItem
        notification={makeNotification({ readAt: "2026-03-24T10:00:00.000Z" })}
      />,
    )
    const btn = screen.getByRole("button")
    expect(btn.className).not.toContain("bg-muted/30")
  })

  it("renders the unread dot indicator when unread", () => {
    const { container } = render(
      <NotificationItem notification={makeNotification({ readAt: null })} />,
    )
    // The dot is an aria-hidden <div> with h-2 w-2 rounded-full.
    // Lucide icons also use aria-hidden but they are <svg>, not <div>.
    const dot = container.querySelector("div[aria-hidden]")
    expect(dot).not.toBeNull()
  })

  it("does NOT render the unread dot when read", () => {
    const { container } = render(
      <NotificationItem
        notification={makeNotification({ readAt: "2026-03-24T10:00:00.000Z" })}
      />,
    )
    const dot = container.querySelector("div[aria-hidden]")
    expect(dot).toBeNull()
  })

  it("uses font-semibold on the title when unread", () => {
    const { container } = render(
      <NotificationItem notification={makeNotification({ readAt: null })} />,
    )
    const title = container.querySelector(".font-semibold")
    expect(title).not.toBeNull()
    expect(title?.textContent).toBe("Application approved")
  })

  it("uses font-medium on the title when read", () => {
    const { container } = render(
      <NotificationItem
        notification={makeNotification({ readAt: "2026-03-24T10:00:00.000Z" })}
      />,
    )
    // font-semibold should NOT be present when read
    const semibold = container.querySelector(".font-semibold")
    expect(semibold).toBeNull()
    const medium = container.querySelector(".font-medium")
    expect(medium?.textContent).toBe("Application approved")
  })
})

// ── onClick callback ──────────────────────────────────────────────────────────

describe("onClick callback", () => {
  it("calls onClick with the notification object when the button is clicked", () => {
    const onClick = vi.fn()
    const notif = makeNotification()
    render(<NotificationItem notification={notif} onClick={onClick} />)
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(notif)
  })

  it("does not throw when onClick is not provided", () => {
    render(<NotificationItem notification={makeNotification()} />)
    expect(() => fireEvent.click(screen.getByRole("button"))).not.toThrow()
  })

  it("calls onClick with the exact notification reference passed in", () => {
    const onClick = vi.fn()
    const notif = makeNotification({ id: "specific-id", title: "Specific title" })
    render(<NotificationItem notification={notif} onClick={onClick} />)
    fireEvent.click(screen.getByRole("button"))
    expect(onClick.mock.calls[0][0].id).toBe("specific-id")
  })
})

// ── relativeTime display ──────────────────────────────────────────────────────

describe("relativeTime display", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FROZEN_NOW)
  })
  afterEach(() => vi.useRealTimers())

  it("shows 'just now' for timestamps less than 1 minute ago", () => {
    const createdAt = new Date(FROZEN_NOW.getTime() - 30_000).toISOString()
    render(<NotificationItem notification={makeNotification({ createdAt })} />)
    expect(screen.getByText("just now")).toBeInTheDocument()
  })

  it("shows 'just now' for the exact same timestamp", () => {
    const createdAt = FROZEN_NOW.toISOString()
    render(<NotificationItem notification={makeNotification({ createdAt })} />)
    expect(screen.getByText("just now")).toBeInTheDocument()
  })

  it("shows 'Xm ago' for timestamps 1–59 minutes ago", () => {
    const createdAt = new Date(FROZEN_NOW.getTime() - 5 * 60_000).toISOString()
    render(<NotificationItem notification={makeNotification({ createdAt })} />)
    expect(screen.getByText("5m ago")).toBeInTheDocument()
  })

  it("shows '59m ago' for 59 minutes ago", () => {
    const createdAt = new Date(FROZEN_NOW.getTime() - 59 * 60_000).toISOString()
    render(<NotificationItem notification={makeNotification({ createdAt })} />)
    expect(screen.getByText("59m ago")).toBeInTheDocument()
  })

  it("shows 'Xh ago' for timestamps 1–23 hours ago", () => {
    const createdAt = new Date(FROZEN_NOW.getTime() - 3 * 60 * 60_000).toISOString()
    render(<NotificationItem notification={makeNotification({ createdAt })} />)
    expect(screen.getByText("3h ago")).toBeInTheDocument()
  })

  it("shows '23h ago' for 23 hours ago", () => {
    const createdAt = new Date(FROZEN_NOW.getTime() - 23 * 60 * 60_000).toISOString()
    render(<NotificationItem notification={makeNotification({ createdAt })} />)
    expect(screen.getByText("23h ago")).toBeInTheDocument()
  })

  it("shows 'Xd ago' for timestamps 1–6 days ago", () => {
    const createdAt = new Date(FROZEN_NOW.getTime() - 2 * 24 * 60 * 60_000).toISOString()
    render(<NotificationItem notification={makeNotification({ createdAt })} />)
    expect(screen.getByText("2d ago")).toBeInTheDocument()
  })

  it("shows a locale date string for timestamps 7+ days ago", () => {
    const oldDate = new Date(FROZEN_NOW.getTime() - 10 * 24 * 60 * 60_000)
    const createdAt = oldDate.toISOString()
    render(<NotificationItem notification={makeNotification({ createdAt })} />)
    expect(screen.getByText(oldDate.toLocaleDateString())).toBeInTheDocument()
  })
})

// ── All notification types render without throwing ────────────────────────────

describe("notification type coverage", () => {
  const TYPES: NotificationType[] = [
    "status_change",
    "document_request",
    "renewal_reminder",
    "deadline",
    "general",
    "session_invite",
    "session_starting",
  ]

  it.each(TYPES)("renders type '%s' without throwing", (type) => {
    expect(() =>
      render(<NotificationItem notification={makeNotification({ type })} />),
    ).not.toThrow()
  })

  it("renders a colored icon for session_invite (violet)", () => {
    const { container } = render(
      <NotificationItem notification={makeNotification({ type: "session_invite" })} />,
    )
    // The icon wrapper div doesn't carry the color — the SVG inside does
    const coloredEl = container.querySelector(".text-violet-500")
    expect(coloredEl).not.toBeNull()
  })

  it("renders a colored icon for deadline (red)", () => {
    const { container } = render(
      <NotificationItem notification={makeNotification({ type: "deadline" })} />,
    )
    const coloredEl = container.querySelector(".text-red-500")
    expect(coloredEl).not.toBeNull()
  })

  it("renders a colored icon for document_request (amber)", () => {
    const { container } = render(
      <NotificationItem notification={makeNotification({ type: "document_request" })} />,
    )
    const coloredEl = container.querySelector(".text-amber-500")
    expect(coloredEl).not.toBeNull()
  })
})
