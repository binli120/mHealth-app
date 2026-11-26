/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { evaluateMedicare } from "@/lib/masshealth/saca2/eligibility/rules/medicare"
import { makeInputs } from "./helpers"

const health = (hasMedicare: boolean, wantsPartBHelp: "yes" | "no" | null) =>
  makeInputs({ health: { hasMedicare, medigapOrPartD: false, wantsPartBHelp, employerCoverageSupplement: false } })

describe("evaluateMedicare", () => {
  it("does not apply without Medicare", () => {
    expect(evaluateMedicare(health(false, null), SACA2_FIGURES).verdict).toBe("notApplicable")
  })

  it("flags an MSP referral when Part B help was requested", () => {
    const o = evaluateMedicare(health(true, "yes"), SACA2_FIGURES)
    expect(o).toMatchObject({ verdict: "pass", estimates: { partBPremium: 202.9 } })
    expect(o.findings[0].code).toBe("SACA2_MSP_REFERRAL")
    expect(o.findings[0].message).toContain("$202.90")
  })

  it("mentions the MSP when Medicare is reported without a help request", () => {
    expect(evaluateMedicare(health(true, "no"), SACA2_FIGURES).findings[0].code).toBe("SACA2_MSP_AVAILABLE")
  })
})
