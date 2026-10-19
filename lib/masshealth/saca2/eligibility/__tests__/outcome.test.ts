/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { finding, outcome, worstVerdict } from "@/lib/masshealth/saca2/eligibility/outcome"
import { SACA2_RULE_IDS, emptyEstimates } from "@/lib/masshealth/saca2/eligibility/types"

describe("outcome helpers", () => {
  it("orders verdicts redirect > fail > review > documents > pass > notApplicable", () => {
    expect(worstVerdict(["pass", "documents"])).toBe("documents")
    expect(worstVerdict(["documents", "review", "pass"])).toBe("review")
    expect(worstVerdict(["review", "fail"])).toBe("fail")
    expect(worstVerdict(["fail", "redirect", "pass"])).toBe("redirect")
    expect(worstVerdict(["notApplicable", "pass"])).toBe("pass")
    expect(worstVerdict([])).toBe("notApplicable")
  })

  it("builds findings and outcomes with empty defaults", () => {
    expect(finding("X", "info", "m")).toEqual({ code: "X", level: "info", message: "m" })
    expect(outcome("SACA2_R8_MEDICARE_MSP", "pass", "ok")).toEqual({
      id: "SACA2_R8_MEDICARE_MSP",
      verdict: "pass",
      message: "ok",
      findings: [],
      estimates: {},
    })
  })

  it("lists the eight rule ids in order and empty estimates are all null", () => {
    expect(SACA2_RULE_IDS).toEqual([
      "SACA2_R1_RESIDENCY_ROUTE",
      "SACA2_R2_CITIZENSHIP",
      "SACA2_R3_ASSETS",
      "SACA2_R4_HOME_EQUITY",
      "SACA2_R5_TRANSFERS",
      "SACA2_R6_INCOME",
      "SACA2_R7_SPOUSAL_ALLOWANCE",
      "SACA2_R8_MEDICARE_MSP",
    ])
    const e = emptyEstimates()
    expect(e.routes).toEqual([])
    expect(Object.entries(e).filter(([k]) => k !== "routes").every(([, v]) => v === null)).toBe(true)
  })
})
