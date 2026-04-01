/**
 * Unit tests for Customer Dashboard page utilities.
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import { getApplicationTypeLabel } from "../page.utils"

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
