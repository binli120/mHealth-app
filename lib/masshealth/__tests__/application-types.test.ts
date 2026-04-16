/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import {
  MASSHEALTH_APPLICATION_TYPES,
  APPLICATION_TYPE_LABELS,
  getApplicationTypeLabel,
  isMassHealthApplicationType,
} from "../application-types"

// ── MASSHEALTH_APPLICATION_TYPES ──────────────────────────────────────────────

describe("MASSHEALTH_APPLICATION_TYPES", () => {
  it("defines supported application type ids in order", () => {
    expect(MASSHEALTH_APPLICATION_TYPES.map((type) => type.id)).toEqual([
      "aca3",
      "aca3ap",
      "saca2",
      "msp",
    ])
  })

  it("every entry has a non-empty id, shortLabel, title, formCode, and referenceUrl", () => {
    for (const type of MASSHEALTH_APPLICATION_TYPES) {
      expect(type.id.length).toBeGreaterThan(0)
      expect(type.shortLabel.length).toBeGreaterThan(0)
      expect(type.title.length).toBeGreaterThan(0)
      expect(type.formCode.length).toBeGreaterThan(0)
      expect(type.referenceUrl.startsWith("https://")).toBe(true)
    }
  })
})

// ── isMassHealthApplicationType ───────────────────────────────────────────────

describe("isMassHealthApplicationType", () => {
  it("returns true for every registered id", () => {
    for (const type of MASSHEALTH_APPLICATION_TYPES) {
      expect(isMassHealthApplicationType(type.id)).toBe(true)
    }
  })

  it("returns false for unknown values", () => {
    expect(isMassHealthApplicationType("unknown")).toBe(false)
    expect(isMassHealthApplicationType("")).toBe(false)
    expect(isMassHealthApplicationType("ACA3")).toBe(false) // case-sensitive
  })
})

// ── APPLICATION_TYPE_LABELS ───────────────────────────────────────────────────

describe("APPLICATION_TYPE_LABELS", () => {
  it("is a Map", () => {
    expect(APPLICATION_TYPE_LABELS).toBeInstanceOf(Map)
  })

  it("has exactly one entry per MASSHEALTH_APPLICATION_TYPES", () => {
    expect(APPLICATION_TYPE_LABELS.size).toBe(MASSHEALTH_APPLICATION_TYPES.length)
  })

  it("maps every registered id to its shortLabel", () => {
    for (const type of MASSHEALTH_APPLICATION_TYPES) {
      expect(APPLICATION_TYPE_LABELS.get(type.id)).toBe(type.shortLabel)
    }
  })

  it("maps 'aca3' → 'ACA-3'", () => {
    expect(APPLICATION_TYPE_LABELS.get("aca3")).toBe("ACA-3")
  })

  it("maps 'aca3ap' → 'ACA-3-AP'", () => {
    expect(APPLICATION_TYPE_LABELS.get("aca3ap")).toBe("ACA-3-AP")
  })

  it("maps 'saca2' → 'SACA-2'", () => {
    expect(APPLICATION_TYPE_LABELS.get("saca2")).toBe("SACA-2")
  })

  it("maps 'msp' → 'MSP'", () => {
    expect(APPLICATION_TYPE_LABELS.get("msp")).toBe("MSP")
  })

  it("returns undefined for an unknown id", () => {
    expect(APPLICATION_TYPE_LABELS.get("not-a-real-form")).toBeUndefined()
  })
})

// ── getApplicationTypeLabel ───────────────────────────────────────────────────

describe("getApplicationTypeLabel", () => {
  // ── null / falsy input ────────────────────────────────────────────────────

  it("returns the default fallback 'Application' when type is null", () => {
    expect(getApplicationTypeLabel(null)).toBe("Application")
  })

  it("returns the default fallback when type is an empty string", () => {
    expect(getApplicationTypeLabel("")).toBe("Application")
  })

  it("returns the default fallback when type is undefined", () => {
    expect(getApplicationTypeLabel(undefined)).toBe("Application")
  })

  it("accepts a custom fallback string", () => {
    expect(getApplicationTypeLabel(null, "申请")).toBe("申请")
    expect(getApplicationTypeLabel("", "N/A")).toBe("N/A")
  })

  // ── known types ───────────────────────────────────────────────────────────

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

  it("the custom fallback is NOT used for known types", () => {
    expect(getApplicationTypeLabel("aca3", "FALLBACK")).toBe("ACA-3")
  })

  // ── unknown types ─────────────────────────────────────────────────────────

  it("returns the uppercased type string for an unknown id", () => {
    expect(getApplicationTypeLabel("custom-form")).toBe("CUSTOM-FORM")
  })

  it("uppercases multi-word unknown ids", () => {
    expect(getApplicationTypeLabel("my-type-v2")).toBe("MY-TYPE-V2")
  })

  it("uppercases even when a custom fallback is supplied", () => {
    expect(getApplicationTypeLabel("zzz", "Fallback")).toBe("ZZZ")
  })
})
