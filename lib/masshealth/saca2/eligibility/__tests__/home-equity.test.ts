/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import { INVALID_AMOUNT } from "@/lib/masshealth/saca2/eligibility/money"
import { evaluateHomeEquity } from "@/lib/masshealth/saca2/eligibility/rules/home-equity"
import type { Saca2SuppAInputs } from "@/lib/masshealth/saca2/eligibility/types"
import { cents, makeInputs, makeSuppA } from "./helpers"

const ltc = (suppA: Partial<Saca2SuppAInputs>, hcbs = false) =>
  evaluateHomeEquity(
    makeInputs({
      programs: { masshealthHsn: false, longTermCare: !hcbs, hcbsWaiver: hcbs },
      suppA: makeSuppA({ needsNursingFacility: hcbs ? "no" : "yes", ownsHome: "yes", ...suppA }),
    }),
    SACA2_FIGURES,
  )
const home = (dollars: number, ownershipType = "individual") => ({ ownershipType, fairMarketValue: cents(dollars) })

describe("evaluateHomeEquity", () => {
  it("does not apply to community applicants or when no home is owned", () => {
    expect(evaluateHomeEquity(makeInputs(), SACA2_FIGURES).verdict).toBe("notApplicable")
    expect(ltc({ ownsHome: "no" }).verdict).toBe("notApplicable")
  })

  it("passes at exactly $1,130,000 and fails one cent over", () => {
    expect(ltc({ homes: [home(1_130_000)] })).toMatchObject({ verdict: "pass", estimates: { homeEquityOverLimit: false } })
    const over = ltc({ homes: [home(1_130_000.01)] })
    expect(over.verdict).toBe("fail")
    expect(over.findings[0].code).toBe("SACA2_HOME_EQUITY_OVER")
  })

  it("applies to HCBS-waiver applicants too", () => {
    expect(ltc({ homes: [home(2_000_000)] }, true).verdict).toBe("fail")
  })

  it("passes with a note when a spouse, child under 21, or disabled child lives there", () => {
    const occupants = { spouse: false, childUnder21: true, disabledChild: false, dependentRelative: false }
    const o = ltc({ homes: [home(2_000_000)], occupants })
    expect(o.verdict).toBe("pass")
    expect(o.findings[0].code).toBe("SACA2_HOME_EQUITY_EXEMPT")
  })

  it("does not exempt for a dependent relative who is not a spouse or child", () => {
    const occupants = { spouse: false, childUnder21: false, disabledChild: false, dependentRelative: true }
    expect(ltc({ homes: [home(2_000_000)], occupants }).verdict).toBe("fail")
  })

  it("reviews shared ownership over the limit and missing or invalid values", () => {
    expect(ltc({ homes: [home(2_000_000, "jointTenancy")] }).findings[0].code).toBe("SACA2_HOME_SHARED_OWNERSHIP")
    expect(ltc({ homes: [{ ownershipType: "individual", fairMarketValue: null }] }).verdict).toBe("review")
    expect(ltc({ homes: [{ ownershipType: "individual", fairMarketValue: INVALID_AMOUNT }] }).verdict).toBe("review")
  })

  it("reviews an unanswered owns-home question or a home with no value listed, never a default", () => {
    expect(ltc({ ownsHome: null }).verdict).toBe("review")
    const none = ltc({ homes: [] })
    expect(none.verdict).toBe("review")
    expect(none.findings[0].code).toBe("SACA2_HOME_VALUE_MISSING")
  })
})
