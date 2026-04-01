/**
 * Unit tests for Application Status Detail page utilities.
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import {
  formatDate,
  formatDateTime,
  readContactField,
  readHouseholdSize,
  readCurrentIncome,
  buildTimeline,
  getApplicationTypeLabel,
} from "../page.utils"
import type { ApplicationDraftRecord } from "../page.types"

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EN = "en"
const ZH = "zh-CN"

/** Minimal valid draft record for test reuse */
function makeRecord(overrides: Partial<ApplicationDraftRecord> = {}): ApplicationDraftRecord {
  return {
    id: "rec-001",
    status: "draft",
    applicationType: "aca3",
    draftState: null,
    draftStep: null,
    lastSavedAt: null,
    submittedAt: null,
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  }
}

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns '—' when value is null", () => {
    expect(formatDate(null, EN)).toBe("—")
  })

  it("returns '—' when value is an empty string", () => {
    expect(formatDate("", EN)).toBe("—")
  })

  it("returns '—' for an invalid date string", () => {
    expect(formatDate("not-a-date", EN)).toBe("—")
  })

  it("returns a formatted date string for a valid ISO date (en)", () => {
    // Use midday UTC to avoid timezone-driven day drift across environments
    const result = formatDate("2026-03-15T12:00:00.000Z", EN)
    expect(result).toMatch(/2026/)
    expect(result).not.toBe("—")
  })

  it("returns a formatted date string for a valid ISO date (zh)", () => {
    const result = formatDate("2026-03-15T00:00:00.000Z", ZH)
    expect(result).toMatch(/2026/)
  })

  it("does not include time components", () => {
    const result = formatDate("2026-06-01T14:30:00.000Z", EN)
    // Time digits should not appear in a date-only format
    expect(result).not.toMatch(/14:30/)
  })
})

// ── formatDateTime ────────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("returns '—' when value is null", () => {
    expect(formatDateTime(null, EN)).toBe("—")
  })

  it("returns '—' when value is an empty string", () => {
    expect(formatDateTime("", EN)).toBe("—")
  })

  it("returns '—' for an invalid date string", () => {
    expect(formatDateTime("bad-date", EN)).toBe("—")
  })

  it("returns a formatted datetime string for a valid ISO datetime (en)", () => {
    const result = formatDateTime("2026-03-15T14:30:00.000Z", EN)
    expect(result).toMatch(/2026/)
    expect(result).toMatch(/15/)
    // Should include time (hour and minute)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it("returns a formatted datetime string for zh locale", () => {
    const result = formatDateTime("2026-03-15T14:30:00.000Z", ZH)
    expect(result).toMatch(/2026/)
  })

  it("includes time components unlike formatDate", () => {
    const dateOnly = formatDate("2026-06-01T14:30:00.000Z", EN)
    const dateTime = formatDateTime("2026-06-01T14:30:00.000Z", EN)
    // datetime output should be longer (has extra time portion)
    expect(dateTime.length).toBeGreaterThan(dateOnly.length)
  })
})

// ── readContactField ──────────────────────────────────────────────────────────

describe("readContactField", () => {
  it("returns '' when record is null", () => {
    expect(readContactField(null, "firstName")).toBe("")
  })

  it("returns '' when draftState is null", () => {
    expect(readContactField(makeRecord(), "firstName")).toBe("")
  })

  it("returns '' when the contact section is missing", () => {
    const record = makeRecord({ draftState: { data: {} } })
    expect(readContactField(record, "firstName")).toBe("")
  })

  it("returns '' when the key does not exist in contact", () => {
    const record = makeRecord({ draftState: { data: { contact: { other: "x" } } } })
    expect(readContactField(record, "firstName")).toBe("")
  })

  it("returns '' when the field value is not a string", () => {
    const record = makeRecord({ draftState: { data: { contact: { age: 42 } } } })
    expect(readContactField(record, "age")).toBe("")
  })

  it("returns the trimmed string value when present", () => {
    const record = makeRecord({ draftState: { data: { contact: { firstName: "  Maria  " } } } })
    expect(readContactField(record, "firstName")).toBe("Maria")
  })

  it("returns the value when no trimming is needed", () => {
    const record = makeRecord({ draftState: { data: { contact: { city: "Boston" } } } })
    expect(readContactField(record, "city")).toBe("Boston")
  })
})

// ── readHouseholdSize ─────────────────────────────────────────────────────────

describe("readHouseholdSize", () => {
  it("returns null when record is null", () => {
    expect(readHouseholdSize(null)).toBeNull()
  })

  it("returns null when draftState is null", () => {
    expect(readHouseholdSize(makeRecord())).toBeNull()
  })

  it("returns null when p1_num_people is missing", () => {
    const record = makeRecord({ draftState: { data: { contact: {} } } })
    expect(readHouseholdSize(record)).toBeNull()
  })

  it("returns null when p1_num_people is not a valid number", () => {
    const record = makeRecord({ draftState: { data: { contact: { p1_num_people: "abc" } } } })
    expect(readHouseholdSize(record)).toBeNull()
  })

  it("returns the parsed integer when p1_num_people is a numeric string", () => {
    const record = makeRecord({ draftState: { data: { contact: { p1_num_people: "4" } } } })
    expect(readHouseholdSize(record)).toBe(4)
  })

  it("parses leading-number strings (parseInt behavior)", () => {
    const record = makeRecord({ draftState: { data: { contact: { p1_num_people: "3 people" } } } })
    expect(readHouseholdSize(record)).toBe(3)
  })

  it("returns 1 for a single-person household", () => {
    const record = makeRecord({ draftState: { data: { contact: { p1_num_people: "1" } } } })
    expect(readHouseholdSize(record)).toBe(1)
  })
})

// ── readCurrentIncome ─────────────────────────────────────────────────────────

describe("readCurrentIncome", () => {
  it("returns '—' when record is null", () => {
    expect(readCurrentIncome(null)).toBe("—")
  })

  it("returns '—' when draftState is null", () => {
    expect(readCurrentIncome(makeRecord())).toBe("—")
  })

  it("returns '—' when persons array is empty", () => {
    const record = makeRecord({ draftState: { data: { persons: [] } } })
    expect(readCurrentIncome(record)).toBe("—")
  })

  it("returns '—' when income section is missing from first person", () => {
    const record = makeRecord({ draftState: { data: { persons: [{ name: "Maria" }] } } })
    expect(readCurrentIncome(record)).toBe("—")
  })

  it("returns '—' when total_income_current_year is an empty string", () => {
    const record = makeRecord({
      draftState: { data: { persons: [{ income: { total_income_current_year: "  " } }] } },
    })
    expect(readCurrentIncome(record)).toBe("—")
  })

  it("returns '—' when total_income_current_year is not a string", () => {
    const record = makeRecord({
      draftState: { data: { persons: [{ income: { total_income_current_year: 50000 } }] } },
    })
    expect(readCurrentIncome(record)).toBe("—")
  })

  it("returns the income value when present", () => {
    const record = makeRecord({
      draftState: { data: { persons: [{ income: { total_income_current_year: "45000" } }] } },
    })
    expect(readCurrentIncome(record)).toBe("45000")
  })

  it("only reads from the first person, not subsequent ones", () => {
    const record = makeRecord({
      draftState: {
        data: {
          persons: [
            { income: {} },
            { income: { total_income_current_year: "60000" } },
          ],
        },
      },
    })
    // Second person's income should not be returned
    expect(readCurrentIncome(record)).toBe("—")
  })
})

// ── buildTimeline ─────────────────────────────────────────────────────────────

describe("buildTimeline", () => {
  it("returns an empty array when record is null", () => {
    expect(buildTimeline(null, EN)).toEqual([])
  })

  it("always includes a 'started' event as the first entry", () => {
    const events = buildTimeline(makeRecord(), EN)
    expect(events[0].id).toBe("started")
    expect(events[0].state).toBe("completed")
  })

  it("always includes a 'decision' event as the last entry", () => {
    const events = buildTimeline(makeRecord(), EN)
    expect(events[events.length - 1].id).toBe("decision")
  })

  it("returns 2 events (started + decision) when no save or submission", () => {
    const events = buildTimeline(makeRecord(), EN)
    expect(events).toHaveLength(2)
    expect(events.map((e) => e.id)).toEqual(["started", "decision"])
  })

  it("adds a 'saved' event when lastSavedAt is set", () => {
    const record = makeRecord({ lastSavedAt: "2026-01-15T12:00:00.000Z", draftStep: 3 })
    const events = buildTimeline(record, EN)
    const saved = events.find((e) => e.id === "saved")
    expect(saved).toBeDefined()
    expect(saved?.description).toContain("3")
  })

  it("marks 'saved' as 'current' when status is draft", () => {
    const record = makeRecord({ lastSavedAt: "2026-01-15T12:00:00.000Z", status: "draft" })
    const events = buildTimeline(record, EN)
    expect(events.find((e) => e.id === "saved")?.state).toBe("current")
  })

  it("marks 'saved' as 'completed' when status is not draft", () => {
    const record = makeRecord({ lastSavedAt: "2026-01-15T12:00:00.000Z", status: "submitted" })
    const events = buildTimeline(record, EN)
    expect(events.find((e) => e.id === "saved")?.state).toBe("completed")
  })

  it("adds a 'submitted' event when submittedAt is set", () => {
    const record = makeRecord({
      status: "submitted",
      submittedAt: "2026-01-16T09:00:00.000Z",
    })
    const events = buildTimeline(record, EN)
    expect(events.find((e) => e.id === "submitted")).toBeDefined()
  })

  it("adds a 'submitted' event when status is not draft even without submittedAt", () => {
    const record = makeRecord({ status: "approved", submittedAt: null })
    const events = buildTimeline(record, EN)
    expect(events.find((e) => e.id === "submitted")).toBeDefined()
  })

  it("marks 'submitted' as 'current' for in-review statuses", () => {
    const inReview = ["submitted", "ai_extracted", "needs_review", "rfi_requested"] as const
    for (const status of inReview) {
      const record = makeRecord({ status, submittedAt: "2026-01-16T09:00:00.000Z" })
      const events = buildTimeline(record, EN)
      expect(events.find((e) => e.id === "submitted")?.state).toBe("current")
    }
  })

  it("marks 'submitted' as 'completed' for approved/denied statuses", () => {
    for (const status of ["approved", "denied"] as const) {
      const record = makeRecord({ status, submittedAt: "2026-01-16T09:00:00.000Z" })
      const events = buildTimeline(record, EN)
      expect(events.find((e) => e.id === "submitted")?.state).toBe("completed")
    }
  })

  it("marks 'decision' as 'completed' when approved", () => {
    const record = makeRecord({ status: "approved" })
    const events = buildTimeline(record, EN)
    expect(events.find((e) => e.id === "decision")?.state).toBe("completed")
  })

  it("marks 'decision' as 'completed' when denied", () => {
    const record = makeRecord({ status: "denied" })
    const events = buildTimeline(record, EN)
    expect(events.find((e) => e.id === "decision")?.state).toBe("completed")
  })

  it("marks 'decision' as 'pending' for non-terminal statuses", () => {
    for (const status of ["draft", "submitted", "needs_review", "rfi_requested"] as const) {
      const record = makeRecord({ status })
      const events = buildTimeline(record, EN)
      expect(events.find((e) => e.id === "decision")?.state).toBe("pending")
    }
  })

  it("every event has the required shape (id, title, description, date, state)", () => {
    const record = makeRecord({
      status: "submitted",
      lastSavedAt: "2026-01-15T12:00:00.000Z",
      submittedAt: "2026-01-16T09:00:00.000Z",
    })
    const events = buildTimeline(record, EN)
    for (const event of events) {
      expect(typeof event.id).toBe("string")
      expect(typeof event.title).toBe("string")
      expect(typeof event.description).toBe("string")
      expect(typeof event.date).toBe("string")
      expect(["completed", "current", "pending"]).toContain(event.state)
    }
  })

  it("uses zh locale strings for Chinese language", () => {
    const events = buildTimeline(makeRecord(), ZH)
    // Chinese locale titles should differ from English
    const enEvents = buildTimeline(makeRecord(), EN)
    expect(events[0].title).not.toBe(enEvents[0].title)
  })
})

// ── getApplicationTypeLabel ───────────────────────────────────────────────────

describe("getApplicationTypeLabel (status detail)", () => {
  it("returns the i18n fallback label when type is null (en)", () => {
    expect(getApplicationTypeLabel(null, EN)).toBe("Application")
  })

  it("returns the i18n fallback label when type is null (zh)", () => {
    expect(getApplicationTypeLabel(null, ZH)).toBe("申请")
  })

  it("returns the short label for a known type", () => {
    expect(getApplicationTypeLabel("aca3", EN)).toBe("ACA-3")
  })

  it("returns the short label regardless of language (labels are not translated)", () => {
    expect(getApplicationTypeLabel("aca3", ZH)).toBe("ACA-3")
  })

  it("returns the uppercased type string for an unknown type", () => {
    expect(getApplicationTypeLabel("custom-form", EN)).toBe("CUSTOM-FORM")
  })

  it("works with all known type ids", () => {
    const knownTypes = [
      { id: "aca3", label: "ACA-3" },
      { id: "aca3ap", label: "ACA-3-AP" },
      { id: "saca2", label: "SACA-2" },
      { id: "msp", label: "MSP" },
    ]
    for (const { id, label } of knownTypes) {
      expect(getApplicationTypeLabel(id, EN)).toBe(label)
    }
  })
})
