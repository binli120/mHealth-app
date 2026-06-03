/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"
import { evaluateWIC } from "@/lib/benefit-orchestration/programs/wic"
import type { FamilyProfile } from "@/lib/benefit-orchestration/types"
import { emptyIncome } from "@/lib/benefit-orchestration/fpl-utils"

function profile(overrides: Partial<FamilyProfile> = {}): FamilyProfile {
  return {
    age: 35,
    pregnant: false,
    disabled: false,
    blind: false,
    over65: false,
    hasMedicare: false,
    hasPrivateInsurance: false,
    hasEmployerInsurance: false,
    citizenshipStatus: "citizen",
    stateResident: true,
    employmentStatus: "employed",
    income: emptyIncome(),
    assets: { bankAccounts: 0, investments: 0, realEstate: 0, vehicles: 0, other: 0 },
    housingStatus: "renter",
    monthlyRent: 0,
    utilityTypes: [],
    taxFiler: false,
    filingStatus: "single",
    isTaxDependent: false,
    householdMembers: [],
    householdSize: 1,
    childrenUnder5: 0,
    childrenUnder13: 0,
    childrenUnder18: 0,
    childrenUnder19: 0,
    ...overrides,
  }
}

describe("evaluateWIC — pregnant minors", () => {
  it("returns WIC for a pregnant 16-year-old", () => {
    const result = evaluateWIC(profile({ age: 16, pregnant: true }), 100)
    expect(result).not.toBeNull()
    expect(result?.programId).toBe("wic")
    expect(result?.keyRequirements.join(" ")).toContain("Pregnant")
  })
})
