/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_STEPS, getStepDef } from "@/lib/masshealth/saca2/schema"

describe("SACA2_STEPS", () => {
  it("has unique ids in form order", () => {
    const ids = SACA2_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      "intake",
      "person1",
      "person2",
      "aian",
      "previousBills",
      "assets",
      "healthInsurance",
      "hra",
      "pca",
      "additionalCoverage",
      "signature",
      "suppA",
      "suppB",
      "suppC",
      "suppD",
      "ard",
      "irs4506",
    ])
  })

  it("maps form pages from the 2026-08 PDF", () => {
    expect(getStepDef("person1").formPages).toEqual([1, 6])
    expect(getStepDef("person2").formPages).toEqual([7, 11])
    expect(getStepDef("assets").formPages).toEqual([12, 15])
    expect(getStepDef("suppA").formPages).toEqual([25, 28])
    expect(getStepDef("suppD").formPages).toEqual([31, 31])
    expect(getStepDef("ard").formPages).toEqual([33, 36])
    expect(getStepDef("irs4506").formPages).toEqual([37, 38])
  })

  it("numbers the form's Steps 1-10 and leaves supplements/attachments unnumbered", () => {
    expect(getStepDef("person1").formStep).toBe(1)
    expect(getStepDef("person2").formStep).toBe(2)
    expect(getStepDef("aian").formStep).toBe(3)
    expect(getStepDef("previousBills").formStep).toBe(4)
    expect(getStepDef("assets").formStep).toBe(5)
    expect(getStepDef("healthInsurance").formStep).toBe(6)
    expect(getStepDef("hra").formStep).toBe(7)
    expect(getStepDef("pca").formStep).toBe(8)
    expect(getStepDef("additionalCoverage").formStep).toBe(9)
    expect(getStepDef("signature").formStep).toBe(10)
    expect(getStepDef("suppA").formStep).toBeNull()
    expect(getStepDef("ard").kind).toBe("attachment")
    expect(getStepDef("suppB").kind).toBe("supplement")
  })

  it("gives every step an i18n title key", () => {
    for (const step of SACA2_STEPS) {
      expect(step.titleKey).toMatch(/^saca2\.step\.[a-zA-Z0-9]+$/)
    }
  })

  it("throws for an unknown step id", () => {
    // @ts-expect-error intentionally invalid
    expect(() => getStepDef("nope")).toThrow(/unknown step/i)
  })
})
