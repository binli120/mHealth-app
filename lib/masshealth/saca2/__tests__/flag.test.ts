/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { isSaca2Enabled } from "@/lib/masshealth/saca2/flag"

describe("isSaca2Enabled", () => {
  it("is on only for true or 1", () => {
    expect(isSaca2Enabled({ SACA2_ENABLED: "true" })).toBe(true)
    expect(isSaca2Enabled({ SACA2_ENABLED: " TRUE " })).toBe(true)
    expect(isSaca2Enabled({ SACA2_ENABLED: "1" })).toBe(true)
  })

  it("is off when unset, empty, or anything else", () => {
    expect(isSaca2Enabled({})).toBe(false)
    expect(isSaca2Enabled({ SACA2_ENABLED: "" })).toBe(false)
    expect(isSaca2Enabled({ SACA2_ENABLED: "false" })).toBe(false)
    expect(isSaca2Enabled({ SACA2_ENABLED: "yes" })).toBe(false)
    expect(isSaca2Enabled({ SACA2_ENABLED: "0" })).toBe(false)
  })
})
