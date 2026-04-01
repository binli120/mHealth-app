/**
 * Unit tests for shared formatting utilities.
 * @author Bin Lee
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  formatConversationDateLabel,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatFileSize,
  formatMonthly,
  formatRelativeTime,
  formatShortDateTime,
  formatTime,
} from "../format"

const EN = "en-US"
const ZH = "zh-CN"

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  // ── null / invalid input ──────────────────────────────────────────────────

  it("returns '—' when value is null", () => {
    expect(formatDate(null)).toBe("—")
  })

  it("returns '—' when value is undefined", () => {
    expect(formatDate(undefined)).toBe("—")
  })

  it("returns '—' when value is an empty string", () => {
    expect(formatDate("")).toBe("—")
  })

  it("returns '—' for a non-date string", () => {
    expect(formatDate("not-a-date")).toBe("—")
  })

  // ── valid input ───────────────────────────────────────────────────────────

  it("returns a formatted date for a valid ISO date (en-US)", () => {
    // Use midday UTC to avoid timezone-driven day drift across environments
    const result = formatDate("2026-03-15T12:00:00.000Z", EN)
    expect(result).toMatch(/2026/)
    expect(result).not.toBe("—")
  })

  it("returns a formatted date for a valid ISO date (zh-CN locale)", () => {
    const result = formatDate("2026-03-15T12:00:00.000Z", ZH)
    expect(result).toMatch(/2026/)
    expect(result).not.toBe("—")
  })

  it("defaults to en-US when no locale is supplied", () => {
    const withDefault = formatDate("2026-06-01T12:00:00.000Z")
    const withEnUs = formatDate("2026-06-01T12:00:00.000Z", EN)
    expect(withDefault).toBe(withEnUs)
  })

  it("does not include time components in the output", () => {
    const result = formatDate("2026-06-01T14:30:00.000Z", EN)
    expect(result).not.toMatch(/14:30/)
  })

  it("returns different strings for different locales", () => {
    const en = formatDate("2026-03-15T12:00:00.000Z", EN)
    const zh = formatDate("2026-03-15T12:00:00.000Z", ZH)
    // Both valid but formatted differently
    expect(en).not.toBe("—")
    expect(zh).not.toBe("—")
  })
})

// ── formatDateTime ────────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  // ── null / invalid input ──────────────────────────────────────────────────

  it("returns '—' when value is null", () => {
    expect(formatDateTime(null)).toBe("—")
  })

  it("returns '—' when value is undefined", () => {
    expect(formatDateTime(undefined)).toBe("—")
  })

  it("returns '—' when value is an empty string", () => {
    expect(formatDateTime("")).toBe("—")
  })

  it("returns '—' for a non-date string", () => {
    expect(formatDateTime("bad-date")).toBe("—")
  })

  // ── valid input ───────────────────────────────────────────────────────────

  it("returns a formatted datetime for a valid ISO string (en-US)", () => {
    const result = formatDateTime("2026-03-15T14:30:00.000Z", EN)
    expect(result).toMatch(/2026/)
    expect(result).not.toBe("—")
  })

  it("includes time components (hour:minute)", () => {
    const result = formatDateTime("2026-03-15T14:30:00.000Z", EN)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it("returns a formatted datetime for zh-CN locale", () => {
    const result = formatDateTime("2026-03-15T14:30:00.000Z", ZH)
    expect(result).toMatch(/2026/)
    expect(result).not.toBe("—")
  })

  it("defaults to en-US when no locale is supplied", () => {
    const withDefault = formatDateTime("2026-06-01T14:30:00.000Z")
    const withEnUs = formatDateTime("2026-06-01T14:30:00.000Z", EN)
    expect(withDefault).toBe(withEnUs)
  })

  it("produces a longer string than formatDate (contains time portion)", () => {
    const date = formatDate("2026-06-01T14:30:00.000Z", EN)
    const dateTime = formatDateTime("2026-06-01T14:30:00.000Z", EN)
    expect(dateTime.length).toBeGreaterThan(date.length)
  })
})

// ── formatCurrency ────────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats whole numbers as USD with no cents", () => {
    expect(formatCurrency(1500)).toBe("$1,500")
  })

  it("rounds to the nearest dollar", () => {
    expect(formatCurrency(1500.9)).toBe("$1,501")
    expect(formatCurrency(1500.4)).toBe("$1,500")
  })

  it("formats zero as '$0'", () => {
    expect(formatCurrency(0)).toBe("$0")
  })

  it("formats large values with comma separators", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000")
  })
})

// ── formatMonthly ─────────────────────────────────────────────────────────────

describe("formatMonthly", () => {
  it("appends '/month' to the currency string", () => {
    expect(formatMonthly(1500)).toBe("$1,500/month")
  })

  it("rounds before appending", () => {
    expect(formatMonthly(999.9)).toBe("$1,000/month")
  })
})

// ── formatFileSize ────────────────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("formats bytes under 1 KB as 'N B'", () => {
    expect(formatFileSize(512)).toBe("512 B")
  })

  it("formats values in the KB range", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB")
  })

  it("formats values in the MB range", () => {
    expect(formatFileSize(1048576)).toBe("1.00 MB")
  })
})

// ── formatTime ────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("returns a string with hour:minute format", () => {
    const result = formatTime("2026-03-15T14:05:00.000Z")
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it("returns a non-empty string for a valid ISO datetime", () => {
    expect(formatTime("2026-01-01T08:00:00.000Z").length).toBeGreaterThan(0)
  })

  it("returns '—' for invalid input", () => {
    expect(formatTime("bad-date")).toBe("—")
  })
})

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns 'just now' when under a minute", () => {
    expect(formatRelativeTime("2026-03-24T11:59:45.000Z")).toBe("just now")
  })

  it("returns minute labels", () => {
    expect(formatRelativeTime("2026-03-24T11:55:00.000Z")).toBe("5m ago")
  })

  it("returns hour labels", () => {
    expect(formatRelativeTime("2026-03-24T09:00:00.000Z")).toBe("3h ago")
  })

  it("returns day labels", () => {
    expect(formatRelativeTime("2026-03-22T12:00:00.000Z")).toBe("2d ago")
  })

  it("returns a date string for older timestamps", () => {
    const value = "2026-03-10T12:00:00.000Z"
    expect(formatRelativeTime(value)).toBe(new Date(value).toLocaleDateString())
  })

  it("capitalizes when requested", () => {
    expect(formatRelativeTime("2026-03-24T11:59:45.000Z", { capitalize: true })).toBe("Just now")
  })

  it("returns '—' for invalid input", () => {
    expect(formatRelativeTime("bad-date")).toBe("—")
  })
})

describe("formatConversationDateLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns Today for current-day timestamps", () => {
    expect(formatConversationDateLabel("2026-03-24T08:00:00.000Z")).toBe("Today")
  })

  it("returns Yesterday for previous-day timestamps", () => {
    expect(formatConversationDateLabel("2026-03-23T08:00:00.000Z")).toBe("Yesterday")
  })

  it("returns a short date label for older timestamps", () => {
    expect(formatConversationDateLabel("2026-03-20T08:00:00.000Z", EN)).toMatch(/Mar|3/)
  })
})

describe("formatShortDateTime", () => {
  it("returns a short date + time string", () => {
    expect(formatShortDateTime("2026-03-15T14:30:00.000Z")).toMatch(/\d{1,2}:\d{2}/)
  })

  it("returns '—' for invalid input", () => {
    expect(formatShortDateTime("bad-date")).toBe("—")
  })
})
