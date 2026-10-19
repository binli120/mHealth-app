/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { evaluateCitizenship } from "@/lib/masshealth/saca2/eligibility/rules/citizenship"
import { makeInputs, makePerson } from "./helpers"

const run = (...people: Parameters<typeof makePerson>[0][]) =>
  evaluateCitizenship(makeInputs({ persons: people.map((p, i) => makePerson({ index: i as 0 | 1, ...p })) }))

describe("evaluateCitizenship", () => {
  it("passes a citizen who gets Medicare, SSI, or SSDI (proof waived, form p.2)", () => {
    expect(run({ citizen: "yes", hasMedicareOrSsiOrSsdi: "yes" }).verdict).toBe("pass")
  })

  it("asks for proof from a citizen without Medicare, SSI, or SSDI (answer No or blank)", () => {
    const no = run({ citizen: "yes", hasMedicareOrSsiOrSsdi: "no" })
    expect(no.verdict).toBe("documents")
    expect(no.findings[0].code).toBe("SACA2_CITIZENSHIP_PROOF")
    expect(run({ citizen: "yes", hasMedicareOrSsiOrSsdi: null }).verdict).toBe("documents")
  })

  it("reviews a noncitizen with a status from the p.32 list", () => {
    const o = run({ citizen: "no", hasEligibleImmigrationStatus: "yes", immigrationStatus: "lawful-permanent-resident" })
    expect(o.verdict).toBe("review")
    expect(o.findings[0].code).toBe("SACA2_IMMIGRATION_STATUS_REVIEW")
  })

  it("reviews a noncitizen with an unknown status slug or no eligible status", () => {
    expect(run({ citizen: "no", hasEligibleImmigrationStatus: "yes", immigrationStatus: "made-up" }).findings[0].code).toBe("SACA2_IMMIGRATION_MISSING")
    expect(run({ citizen: "no", hasEligibleImmigrationStatus: "no" }).findings[0].code).toBe("SACA2_IMMIGRATION_LIMITED")
  })

  it("reviews a missing citizenship answer", () => {
    expect(run({ citizen: null }).findings[0].code).toBe("SACA2_CITIZENSHIP_MISSING")
  })

  it("takes the worst verdict across applicants and labels people by number, not name", () => {
    const o = run({ citizen: "yes", hasMedicareOrSsiOrSsdi: "yes" }, { citizen: "no", hasEligibleImmigrationStatus: "no" })
    expect(o.verdict).toBe("review")
    expect(o.findings[0].message).toMatch(/^Person 2:/)
  })

  it("ignores a Person 2 who is not applying and is notApplicable with no applicants", () => {
    expect(run({ citizen: "yes", hasMedicareOrSsiOrSsdi: "yes" }, { applying: false, citizen: null }).verdict).toBe("pass")
    expect(run({ applying: false }).verdict).toBe("notApplicable")
  })
})
