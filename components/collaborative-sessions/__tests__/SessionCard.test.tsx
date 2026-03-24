/**
 * Unit tests for the SessionCard component.
 * Verifies that the right action buttons are shown for each role / status combo.
 * @author Bin Lee
 */

import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SessionCard } from "@/components/collaborative-sessions/SessionCard"
import type { SessionSummary } from "@/lib/collaborative-sessions/types"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    title,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    title?: string
  }) => React.createElement("a", { href, className, title }, children),
}))

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "session-1",
    swUserId: "sw-1",
    swName: "Jane SW",
    patientUserId: "patient-1",
    patientName: "John Patient",
    status: "scheduled",
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    inviteMessage: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

describe("status badge", () => {
  it.each([
    ["scheduled", "Invited"],
    ["active",    "Live"],
    ["ended",     "Ended"],
    ["cancelled", "Cancelled"],
  ] as const)("shows '%s' label for status %s", (status, label) => {
    render(<SessionCard session={makeSession({ status })} role="sw" />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

// ── SW role ───────────────────────────────────────────────────────────────────

describe("SW role", () => {
  it("shows 'Start Session' when session is scheduled", () => {
    render(<SessionCard session={makeSession({ status: "scheduled" })} role="sw" />)
    expect(screen.getByText("Start Session")).toBeInTheDocument()
  })

  it("shows 'Join Now' when session is active", () => {
    render(<SessionCard session={makeSession({ status: "active" })} role="sw" />)
    expect(screen.getByText("Join Now")).toBeInTheDocument()
  })

  it("shows 'Delete' button for ended sessions", () => {
    const onDelete = vi.fn()
    render(
      <SessionCard
        session={makeSession({ status: "ended" })}
        role="sw"
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText("Delete")).toBeInTheDocument()
  })

  it("shows 'Delete' button for cancelled sessions", () => {
    const onDelete = vi.fn()
    render(
      <SessionCard
        session={makeSession({ status: "cancelled" })}
        role="sw"
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText("Delete")).toBeInTheDocument()
  })

  it("does NOT show 'Delete' for active sessions", () => {
    render(<SessionCard session={makeSession({ status: "active" })} role="sw" />)
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
  })

  it("does NOT show 'Delete' for scheduled sessions", () => {
    render(<SessionCard session={makeSession({ status: "scheduled" })} role="sw" />)
    expect(screen.queryByText("Delete")).not.toBeInTheDocument()
  })

  it("does not show Accept/Decline for SW", () => {
    render(<SessionCard session={makeSession({ status: "scheduled" })} role="sw" />)
    expect(screen.queryByText("Accept")).not.toBeInTheDocument()
    expect(screen.queryByText("Decline")).not.toBeInTheDocument()
  })

  it("shows patient name as the other party", () => {
    render(<SessionCard session={makeSession()} role="sw" />)
    expect(screen.getByText("John Patient")).toBeInTheDocument()
  })

  it("disables Delete button while deleting", () => {
    render(
      <SessionCard
        session={makeSession({ status: "ended" })}
        role="sw"
        deleting
      />,
    )
    const btn = screen.getByText("Delete").closest("button")
    expect(btn).toBeDisabled()
  })
})

// ── Patient role ──────────────────────────────────────────────────────────────

describe("patient role", () => {
  it("shows Accept and Decline for scheduled sessions", () => {
    render(<SessionCard session={makeSession({ status: "scheduled" })} role="patient" />)
    expect(screen.getByText("Accept")).toBeInTheDocument()
    expect(screen.getByText("Decline")).toBeInTheDocument()
  })

  it("shows 'Join Now' when session is active", () => {
    render(<SessionCard session={makeSession({ status: "active" })} role="patient" />)
    expect(screen.getByText("Join Now")).toBeInTheDocument()
  })

  it("does NOT show Delete for patient (any status)", () => {
    for (const status of ["ended", "cancelled"] as const) {
      const { unmount } = render(
        <SessionCard session={makeSession({ status })} role="patient" />,
      )
      expect(screen.queryByText("Delete")).not.toBeInTheDocument()
      unmount()
    }
  })

  it("does not show Start Session for patient", () => {
    render(<SessionCard session={makeSession({ status: "scheduled" })} role="patient" />)
    expect(screen.queryByText("Start Session")).not.toBeInTheDocument()
  })

  it("shows SW name as the other party", () => {
    render(<SessionCard session={makeSession()} role="patient" />)
    expect(screen.getByText("Jane SW")).toBeInTheDocument()
  })

  it("disables Accept/Decline while accepting", () => {
    render(
      <SessionCard
        session={makeSession({ status: "scheduled" })}
        role="patient"
        accepting
      />,
    )
    expect(screen.getByText("Accept").closest("button")).toBeDisabled()
    expect(screen.getByText("Decline").closest("button")).toBeDisabled()
  })
})

// ── Invite message ────────────────────────────────────────────────────────────

describe("invite message", () => {
  it("shows invite message when status is scheduled", () => {
    const msg = "We'll fill your MassHealth renewal together."
    render(
      <SessionCard
        session={makeSession({ status: "scheduled", inviteMessage: msg })}
        role="patient"
      />,
    )
    // &ldquo;/&rdquo; surround the message — use partial match
    expect(screen.getByText(msg, { exact: false })).toBeInTheDocument()
  })

  it("does NOT show invite message for non-scheduled status", () => {
    const msg = "Some unique note"
    render(
      <SessionCard
        session={makeSession({ status: "active", inviteMessage: msg })}
        role="patient"
      />,
    )
    expect(screen.queryByText(msg, { exact: false })).not.toBeInTheDocument()
  })
})

// ── Room link href ────────────────────────────────────────────────────────────

describe("room link", () => {
  it("links SW to /social-worker/sessions/:id", () => {
    const { container } = render(
      <SessionCard session={makeSession({ status: "active" })} role="sw" />,
    )
    const link = container.querySelector("a[href='/social-worker/sessions/session-1']")
    expect(link).not.toBeNull()
  })

  it("links patient to /customer/sessions/:id", () => {
    const { container } = render(
      <SessionCard session={makeSession({ status: "active" })} role="patient" />,
    )
    const link = container.querySelector("a[href='/customer/sessions/session-1']")
    expect(link).not.toBeNull()
  })
})
