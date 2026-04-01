/**
 * Unit tests for Application Status Detail page constants.
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import {
  MASSHEALTH_APPLICATION_TYPES,
  APPLICATION_TYPE_LABELS as LIB_APPLICATION_TYPE_LABELS,
} from "../../../../../lib/masshealth/application-types"
import { APPLICATION_TYPE_LABELS } from "../page.constants"

describe("APPLICATION_TYPE_LABELS (status/[id] re-export from lib)", () => {
  it("is the same Map instance as lib/masshealth/application-types", () => {
    expect(APPLICATION_TYPE_LABELS).toBe(LIB_APPLICATION_TYPE_LABELS)
  })

  it("is a Map", () => {
    expect(APPLICATION_TYPE_LABELS).toBeInstanceOf(Map)
  })

  it("has exactly as many entries as MASSHEALTH_APPLICATION_TYPES", () => {
    expect(APPLICATION_TYPE_LABELS.size).toBe(MASSHEALTH_APPLICATION_TYPES.length)
  })

  it("has an entry for every application type id", () => {
    for (const type of MASSHEALTH_APPLICATION_TYPES) {
      expect(APPLICATION_TYPE_LABELS.has(type.id)).toBe(true)
    }
  })

  it("maps each id to its shortLabel", () => {
    for (const type of MASSHEALTH_APPLICATION_TYPES) {
      expect(APPLICATION_TYPE_LABELS.get(type.id)).toBe(type.shortLabel)
    }
  })

  it("returns undefined for an unknown id", () => {
    expect(APPLICATION_TYPE_LABELS.get("not-a-real-form")).toBeUndefined()
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
})
