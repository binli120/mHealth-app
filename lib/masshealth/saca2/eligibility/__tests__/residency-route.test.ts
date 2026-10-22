/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { determineRoutes } from "@/lib/masshealth/saca2/eligibility/routes"
import { evaluateResidencyRoute } from "@/lib/masshealth/saca2/eligibility/rules/residency-route"
import { facilityCouple, makeInputs, makePerson, makeSuppA } from "./helpers"

const codes = (o: { findings: Array<{ code: string }> }) => o.findings.map((f) => f.code)

describe("determineRoutes", () => {
  it("is senior at 65 but not at 64", () => {
    expect(determineRoutes(makeInputs({ persons: [makePerson({ age: 65 })] }))).toEqual(["senior"])
    expect(determineRoutes(makeInputs({ persons: [makePerson({ age: 64 })] }))).toEqual([])
  })

  it("adds facility, HCBS, PACE and screening routes", () => {
    const inputs = makeInputs({
      persons: [makePerson({ age: 50 })],
      programs: { masshealthHsn: false, longTermCare: true, hcbsWaiver: true },
      suppA: makeSuppA({ applyingPace: "yes" }),
      screening: { disabledAndWorkingQualifies: "yes", commonHealthTenYears: "yes" },
    })
    expect(determineRoutes(inputs)).toEqual(["nursingFacility", "hcbsWaiver", "pace", "disabledWorking", "commonHealthTenYears"])
  })

  it("detects a mixed-age married couple living together, both applying", () => {
    const inputs = makeInputs({
      persons: [makePerson({ age: 71 }), makePerson({ index: 1, age: 58, livesWithPerson1: "yes" })],
      hasSpouse: true,
      householdSize: 2,
    })
    expect(determineRoutes(inputs)).toEqual(["senior", "mixedAgeCouple"])
    expect(determineRoutes({ ...inputs, hasSpouse: false })).toEqual(["senior"])
  })
})

describe("evaluateResidencyRoute", () => {
  it("passes a Massachusetts resident aged 65 and reports the routes", () => {
    const o = evaluateResidencyRoute(makeInputs({ persons: [makePerson({ age: 65 })] }))
    expect(o.verdict).toBe("pass")
    expect(o.estimates.routes).toEqual(["senior"])
  })

  it("asks for review when a 64-year-old has no SACA-2 route", () => {
    const o = evaluateResidencyRoute(makeInputs({ persons: [makePerson({ age: 64 })] }))
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_ROUTE_UNCLEAR")
  })

  it("asks for review when the age is unknown and nothing else gives a route", () => {
    expect(codes(evaluateResidencyRoute(makeInputs({ persons: [makePerson({ age: null })] })))).toContain("SACA2_AGE_UNKNOWN")
  })

  it("redirects a caregiver of a child who is 18 on the screening date, or with no dates listed", () => {
    const eighteen = makeInputs({ persons: [makePerson({ caregiverOfChildUnder19: "yes", childAges: [18] })] })
    expect(evaluateResidencyRoute(eighteen).verdict).toBe("redirect")
    const noDates = makeInputs({ persons: [makePerson({ caregiverOfChildUnder19: "yes", childAges: [] })] })
    expect(evaluateResidencyRoute(noDates).verdict).toBe("redirect")
  })

  it("asks for review when every listed child is already 19", () => {
    const o = evaluateResidencyRoute(makeInputs({ persons: [makePerson({ caregiverOfChildUnder19: "yes", childAges: [19, 25] })] }))
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_CHILD_AGE_CONFLICT")
  })

  it("does not redirect a caregiver who needs nursing-facility care", () => {
    const inputs = facilityCouple()
    inputs.persons[0].caregiverOfChildUnder19 = "yes"
    inputs.persons[0].childAges = [10]
    const o = evaluateResidencyRoute(inputs)
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_CAREGIVER_LONG_TERM_CARE")
  })

  it("fails when no one applying lives in Massachusetts, reviews when only some do or the answer is missing", () => {
    expect(evaluateResidencyRoute(makeInputs({ persons: [makePerson({ resident: "no" })] })).verdict).toBe("fail")
    const mixed = makeInputs({
      persons: [makePerson({ resident: "yes" }), makePerson({ index: 1, resident: "no", livesWithPerson1: "yes" })],
      hasSpouse: true,
      householdSize: 2,
    })
    expect(codes(evaluateResidencyRoute(mixed))).toContain("SACA2_SOME_NOT_RESIDENT")
    expect(codes(evaluateResidencyRoute(makeInputs({ persons: [makePerson({ resident: null })] })))).toContain("SACA2_RESIDENCY_MISSING")
  })

  it("ignores a Person 2 who is not applying", () => {
    const inputs = facilityCouple()
    expect(inputs.persons[1].resident).toBeNull()
    expect(evaluateResidencyRoute(inputs).verdict).toBe("pass")
  })

  it("reviews when no one is applying", () => {
    expect(codes(evaluateResidencyRoute(makeInputs({ persons: [makePerson({ applying: false })] })))).toContain("SACA2_NO_APPLICANT")
  })
})

describe("evaluateResidencyRoute: long-term-care caregivers", () => {
  const caregiver = (overrides: Partial<Parameters<typeof makeInputs>[0]>) =>
    makeInputs({ persons: [makePerson({ caregiverOfChildUnder19: "yes", childAges: [11] })], ...overrides })

  it("gives review, not a redirect, for an HCBS-waiver applicant who cares for a child", () => {
    const o = evaluateResidencyRoute(caregiver({ programs: { masshealthHsn: false, longTermCare: false, hcbsWaiver: true } }))
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_CAREGIVER_LONG_TERM_CARE")
  })

  it("gives review, not a redirect, for a PACE applicant who cares for a child", () => {
    const o = evaluateResidencyRoute(caregiver({ suppA: makeSuppA({ applyingPace: "yes" }) }))
    expect(o.verdict).toBe("review")
    expect(codes(o)).toContain("SACA2_CAREGIVER_LONG_TERM_CARE")
  })
})
