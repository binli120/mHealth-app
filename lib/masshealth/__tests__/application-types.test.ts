/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import {
  MASSHEALTH_APPLICATION_TYPES,
  isMassHealthApplicationType,
} from "@/lib/masshealth/application-types"

describe("lib/masshealth/application-types", () => {
  it("defines supported application type options", () => {
    expect(MASSHEALTH_APPLICATION_TYPES.map((type) => type.id)).toEqual([
      "aca3",
      "aca3ap",
      "saca2",
      "msp",
    ])
  })

  it("validates type guard", () => {
    expect(isMassHealthApplicationType("aca3")).toBe(true)
    expect(isMassHealthApplicationType("unknown")).toBe(false)
  })
})
