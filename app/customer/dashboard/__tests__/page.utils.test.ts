/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Unit tests for Customer Dashboard page utilities.
 * @author: Bin Lee
 */

import { describe, it, expect } from "vitest"
import type { ApplicationListRecord } from "@/lib/applications/types"
import {
  buildDashboardGreeting,
  getApplicationTypeLabel,
  getLatestDraftApplication,
  getTimeOfDayGreeting,
} from "../page.utils"

function makeApplication(overrides: Partial<ApplicationListRecord> = {}): ApplicationListRecord {
  return {
    id: "app-1",
    status: "submitted",
    applicationType: "aca3",
    draftStep: null,
    lastSavedAt: null,
    submittedAt: "2026-05-01T12:00:00.000Z",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
    applicantName: "Jane Patient",
    householdSize: 1,
    phiDraftLocked: false,
    ...overrides,
  }
}

describe("getApplicationTypeLabel", () => {
  // ── Null / falsy input ────────────────────────────────────────────────────

  it("returns 'Application' when type is null", () => {
    expect(getApplicationTypeLabel(null)).toBe("Application")
  })

  it("returns 'Application' when type is an empty string", () => {
    expect(getApplicationTypeLabel("")).toBe("Application")
  })

  // ── Known application types ───────────────────────────────────────────────

  it("returns the short label for 'aca3'", () => {
    expect(getApplicationTypeLabel("aca3")).toBe("ACA-3")
  })

  it("returns the short label for 'aca3ap'", () => {
    expect(getApplicationTypeLabel("aca3ap")).toBe("ACA-3-AP")
  })

  it("returns the short label for 'saca2'", () => {
    expect(getApplicationTypeLabel("saca2")).toBe("SACA-2")
  })

  it("returns the short label for 'msp'", () => {
    expect(getApplicationTypeLabel("msp")).toBe("MSP")
  })

  // ── Unknown / unregistered types ──────────────────────────────────────────

  it("returns the uppercased type string when type is unknown", () => {
    expect(getApplicationTypeLabel("custom-form")).toBe("CUSTOM-FORM")
  })

  it("uppercases multi-word unknown types", () => {
    expect(getApplicationTypeLabel("my-type-v2")).toBe("MY-TYPE-V2")
  })

  it("returns the type uppercased when it does not match any registered id", () => {
    expect(getApplicationTypeLabel("zzz")).toBe("ZZZ")
  })
})

describe("getTimeOfDayGreeting", () => {
  it("returns morning before noon", () => {
    expect(getTimeOfDayGreeting(new Date("2026-05-05T09:00:00"))).toBe("Good morning")
  })

  it("returns afternoon from noon through late afternoon", () => {
    expect(getTimeOfDayGreeting(new Date("2026-05-05T12:00:00"))).toBe("Good afternoon")
    expect(getTimeOfDayGreeting(new Date("2026-05-05T16:59:00"))).toBe("Good afternoon")
  })

  it("returns evening at 5 PM and later", () => {
    expect(getTimeOfDayGreeting(new Date("2026-05-05T17:00:00"))).toBe("Good evening")
  })
})

describe("getLatestDraftApplication", () => {
  it("returns the most recently saved draft", () => {
    const olderDraft = makeApplication({
      id: "older-draft",
      status: "draft",
      lastSavedAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z",
    })
    const newerDraft = makeApplication({
      id: "newer-draft",
      status: "draft",
      lastSavedAt: "2026-05-03T12:00:00.000Z",
      updatedAt: "2026-05-03T12:00:00.000Z",
    })

    expect(getLatestDraftApplication([olderDraft, makeApplication(), newerDraft])?.id).toBe("newer-draft")
  })
})

describe("buildDashboardGreeting", () => {
  const now = new Date("2026-05-05T14:00:00")

  it("prioritizes action-required applications", () => {
    const greeting = buildDashboardGreeting({
      applications: [
        makeApplication({ id: "draft-1", status: "draft" }),
        makeApplication({ id: "rfi-1", status: "rfi_requested" }),
      ],
      greetingName: "John",
      now,
      unreadNotificationCount: 3,
    })

    expect(greeting.heading).toBe("Good afternoon, John. MassHealth needs something from you.")
    expect(greeting.message).toContain("Application rfi-1 has an action item")
    expect(greeting.cta).toEqual({ href: "/customer/status/rfi-1", label: "Review request" })
  })

  it("uses unread notification greeting when there is no action-required application", () => {
    const greeting = buildDashboardGreeting({
      applications: [makeApplication()],
      greetingName: "John",
      now,
      unreadNotificationCount: 1,
    })

    expect(greeting.heading).toBe("Good afternoon, John. You have 1 new notification.")
    expect(greeting.cta).toEqual({ href: "/notifications", label: "Check notifications" })
  })

  it("prompts the user to continue the latest draft", () => {
    const greeting = buildDashboardGreeting({
      applications: [
        makeApplication({
          id: "old-draft",
          status: "draft",
          lastSavedAt: "2026-05-01T12:00:00.000Z",
          updatedAt: "2026-05-01T12:00:00.000Z",
        }),
        makeApplication({
          id: "latest-draft",
          status: "draft",
          applicationType: "aca3ap",
          lastSavedAt: "2026-05-04T12:00:00.000Z",
          updatedAt: "2026-05-04T12:00:00.000Z",
        }),
      ],
      greetingName: "John",
      now,
      unreadNotificationCount: 0,
    })

    expect(greeting.heading).toBe("Good afternoon, John. Want to continue your unfinished application?")
    expect(greeting.message).toContain("ACA-3-AP was last saved")
    expect(greeting.cta).toEqual({ href: "/application/new?applicationId=latest-draft&mode=wizard", label: "Continue application" })
  })

  it("welcomes a user with no applications", () => {
    const greeting = buildDashboardGreeting({
      applications: [],
      greetingName: "John",
      now,
      unreadNotificationCount: 0,
    })

    expect(greeting.heading).toBe("Good afternoon, John. How can I help you today?")
    expect(greeting.cta).toEqual({ href: "/application/type", label: "Start application" })
  })

  it("falls back to a status overview when there is normal activity", () => {
    const greeting = buildDashboardGreeting({
      applications: [makeApplication({ status: "approved" })],
      greetingName: "John",
      now,
      unreadNotificationCount: 0,
    })

    expect(greeting.heading).toBe("Good afternoon, John. Here is where things stand today.")
    expect(greeting.cta).toEqual({ href: "/customer/status", label: "View status" })
  })
})
