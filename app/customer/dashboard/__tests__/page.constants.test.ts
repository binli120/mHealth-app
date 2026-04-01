/**
 * Unit tests for Customer Dashboard page constants.
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import { APPLICATION_STATUSES } from "../../../../lib/application-status"
import {
  MASSHEALTH_APPLICATION_TYPES,
  APPLICATION_TYPE_LABELS as LIB_APPLICATION_TYPE_LABELS,
} from "../../../../lib/masshealth/application-types"
import { STATUS_META, APPLICATION_TYPE_LABELS } from "../page.constants"

// ── STATUS_META ───────────────────────────────────────────────────────────────

describe("STATUS_META", () => {
  it("has an entry for every ApplicationStatus", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(STATUS_META).toHaveProperty(status)
    }
  })

  it("has no extra entries beyond the defined statuses", () => {
    const metaKeys = Object.keys(STATUS_META)
    const statusSet = new Set(APPLICATION_STATUSES)
    for (const key of metaKeys) {
      expect(statusSet.has(key as never)).toBe(true)
    }
  })

  it("every entry has a non-empty color string", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(typeof STATUS_META[status].color).toBe("string")
      expect(STATUS_META[status].color.length).toBeGreaterThan(0)
    }
  })

  it("every entry has an icon (React component — function or forwardRef object)", () => {
    for (const status of APPLICATION_STATUSES) {
      const { icon } = STATUS_META[status]
      const isComponent = typeof icon === "function" || (typeof icon === "object" && icon !== null)
      expect(isComponent).toBe(true)
    }
  })

  // ── Spot-check individual statuses ────────────────────────────────────────

  it("'draft' uses a secondary color class", () => {
    expect(STATUS_META.draft.color).toContain("secondary")
  })

  it("'approved' uses a success color class", () => {
    expect(STATUS_META.approved.color).toContain("success")
  })

  it("'denied' uses a destructive color class", () => {
    expect(STATUS_META.denied.color).toContain("destructive")
  })

  it("'rfi_requested' uses a warning color class", () => {
    expect(STATUS_META.rfi_requested.color).toContain("warning")
  })

  it("'submitted' uses a primary color class", () => {
    expect(STATUS_META.submitted.color).toContain("primary")
  })
})

// ── APPLICATION_TYPE_LABELS ───────────────────────────────────────────────────
// page.constants re-exports from lib — both references should be the same object.

describe("APPLICATION_TYPE_LABELS (re-export from lib)", () => {
  it("is the same Map instance as lib/masshealth/application-types", () => {
    expect(APPLICATION_TYPE_LABELS).toBe(LIB_APPLICATION_TYPE_LABELS)
  })

  it("is a Map", () => {
    expect(APPLICATION_TYPE_LABELS).toBeInstanceOf(Map)
  })

  it("has an entry for every MASSHEALTH_APPLICATION_TYPES id", () => {
    for (const type of MASSHEALTH_APPLICATION_TYPES) {
      expect(APPLICATION_TYPE_LABELS.has(type.id)).toBe(true)
    }
  })

  it("maps each id to its shortLabel", () => {
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
    expect(APPLICATION_TYPE_LABELS.get("unknown-id")).toBeUndefined()
  })

  it("has exactly as many entries as MASSHEALTH_APPLICATION_TYPES", () => {
    expect(APPLICATION_TYPE_LABELS.size).toBe(MASSHEALTH_APPLICATION_TYPES.length)
  })
})
