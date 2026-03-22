/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import {
  ACCOUNT_TYPE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  ERROR_USER_PROFILE_INVALID_PAYLOAD,
  ERROR_USER_PROFILE_LOG_PREFIX,
  ERROR_USER_PROFILE_NOT_FOUND,
  ERROR_USER_PROFILE_SAVE_FAILED,
  GENDER_OPTIONS,
  NOTIFICATION_CHANNEL_OPTIONS,
  REMINDER_LEAD_DAY_OPTIONS,
} from "@/lib/user-profile/constants"

// ── EDUCATION_LEVEL_OPTIONS ─────────────────────────────────────────────────

describe("EDUCATION_LEVEL_OPTIONS", () => {
  it("has exactly 6 entries", () => {
    expect(EDUCATION_LEVEL_OPTIONS).toHaveLength(6)
  })

  it("contains all expected education level values in order", () => {
    const values = EDUCATION_LEVEL_OPTIONS.map((o) => o.value)
    expect(values).toEqual([
      "less_than_high_school",
      "high_school_or_ged",
      "some_college",
      "associates",
      "bachelors",
      "graduate_or_professional",
    ])
  })

  it("every entry has a non-empty label", () => {
    for (const option of EDUCATION_LEVEL_OPTIONS) {
      expect(option.label.trim()).not.toBe("")
    }
  })
})

// ── GENDER_OPTIONS ──────────────────────────────────────────────────────────

describe("GENDER_OPTIONS", () => {
  it("has exactly 4 entries", () => {
    expect(GENDER_OPTIONS).toHaveLength(4)
  })

  it("includes male, female, non_binary, and prefer_not_to_say", () => {
    const values = GENDER_OPTIONS.map((o) => o.value)
    expect(values).toContain("male")
    expect(values).toContain("female")
    expect(values).toContain("non_binary")
    expect(values).toContain("prefer_not_to_say")
  })

  it("every entry has a non-empty label", () => {
    for (const option of GENDER_OPTIONS) {
      expect(option.label.trim()).not.toBe("")
    }
  })
})

// ── ACCOUNT_TYPE_OPTIONS ────────────────────────────────────────────────────

describe("ACCOUNT_TYPE_OPTIONS", () => {
  it("has exactly 2 entries", () => {
    expect(ACCOUNT_TYPE_OPTIONS).toHaveLength(2)
  })

  it("includes checking and savings", () => {
    const values = ACCOUNT_TYPE_OPTIONS.map((o) => o.value)
    expect(values).toContain("checking")
    expect(values).toContain("savings")
  })

  it("every entry has a non-empty label", () => {
    for (const option of ACCOUNT_TYPE_OPTIONS) {
      expect(option.label.trim()).not.toBe("")
    }
  })
})

// ── NOTIFICATION_CHANNEL_OPTIONS ────────────────────────────────────────────

describe("NOTIFICATION_CHANNEL_OPTIONS", () => {
  it("has exactly 3 entries", () => {
    expect(NOTIFICATION_CHANNEL_OPTIONS).toHaveLength(3)
  })

  it("includes email, sms, and both", () => {
    const values = NOTIFICATION_CHANNEL_OPTIONS.map((o) => o.value)
    expect(values).toContain("email")
    expect(values).toContain("sms")
    expect(values).toContain("both")
  })

  it("every entry has a non-empty label", () => {
    for (const option of NOTIFICATION_CHANNEL_OPTIONS) {
      expect(option.label.trim()).not.toBe("")
    }
  })
})

// ── REMINDER_LEAD_DAY_OPTIONS ───────────────────────────────────────────────

describe("REMINDER_LEAD_DAY_OPTIONS", () => {
  it("has exactly 3 entries", () => {
    expect(REMINDER_LEAD_DAY_OPTIONS).toHaveLength(3)
  })

  it("includes values 7, 14, and 30", () => {
    const values = REMINDER_LEAD_DAY_OPTIONS.map((o) => o.value)
    expect(values).toContain("7")
    expect(values).toContain("14")
    expect(values).toContain("30")
  })

  it("every entry has a non-empty label", () => {
    for (const option of REMINDER_LEAD_DAY_OPTIONS) {
      expect(option.label.trim()).not.toBe("")
    }
  })
})

// ── Error constants ─────────────────────────────────────────────────────────

describe("error constants", () => {
  it("ERROR_USER_PROFILE_NOT_FOUND is a non-empty string", () => {
    expect(typeof ERROR_USER_PROFILE_NOT_FOUND).toBe("string")
    expect(ERROR_USER_PROFILE_NOT_FOUND.trim().length).toBeGreaterThan(0)
  })

  it("ERROR_USER_PROFILE_SAVE_FAILED is a non-empty string", () => {
    expect(typeof ERROR_USER_PROFILE_SAVE_FAILED).toBe("string")
    expect(ERROR_USER_PROFILE_SAVE_FAILED.trim().length).toBeGreaterThan(0)
  })

  it("ERROR_USER_PROFILE_INVALID_PAYLOAD is a non-empty string", () => {
    expect(typeof ERROR_USER_PROFILE_INVALID_PAYLOAD).toBe("string")
    expect(ERROR_USER_PROFILE_INVALID_PAYLOAD.trim().length).toBeGreaterThan(0)
  })

  it("ERROR_USER_PROFILE_LOG_PREFIX starts with '['", () => {
    expect(ERROR_USER_PROFILE_LOG_PREFIX.startsWith("[")).toBe(true)
  })

  it("all error constants are distinct", () => {
    const constants = [
      ERROR_USER_PROFILE_NOT_FOUND,
      ERROR_USER_PROFILE_SAVE_FAILED,
      ERROR_USER_PROFILE_INVALID_PAYLOAD,
      ERROR_USER_PROFILE_LOG_PREFIX,
    ]
    const unique = new Set(constants)
    expect(unique.size).toBe(constants.length)
  })
})
