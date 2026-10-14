/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  SACA2_FORM_CODE,
  SACA2_PHI_KEYS,
  SACA2_SCHEMA_VERSION,
  SACA2_SERVER_SAFE_KEYS,
  emptySaca2Answers,
  emptySaca2Person,
} from "@/lib/masshealth/saca2/types"

describe("emptySaca2Answers", () => {
  it("starts with exactly one blank person and every yes/no unanswered", () => {
    const a = emptySaca2Answers()
    expect(a.persons).toHaveLength(1)
    expect(a.persons[0]).toEqual(emptySaca2Person())
    expect(a.persons[0].dateOfBirth).toBeNull()
    expect(a.persons[0].isLegallyMarried).toBeNull()
    expect(a.supplements.a.needsNursingFacility).toBeNull()
    expect(a.aian.anyMember).toBeNull()
    expect(a.signature.signedBy).toBeNull()
  })

  it("returns independent objects on every call", () => {
    const a = emptySaca2Answers()
    const b = emptySaca2Answers()
    a.persons[0].firstName = "Ada"
    a.transfers.push({
      description: "gift",
      dateOfTransfer: "2025-01-01",
      transferredTo: "child",
      relationship: "child",
      amount: 100,
    })
    expect(b.persons[0].firstName).toBe("")
    expect(b.transfers).toHaveLength(0)
  })
})

describe("constants", () => {
  it("pins version strings to the PDF footer / schema version", () => {
    expect(SACA2_FORM_CODE).toBe("SACA-2_2026-08")
    expect(SACA2_SCHEMA_VERSION).toBe("saca2-2026-08")
  })

  it("classifies every top-level answer key as PHI or server-safe, and only intake/signature are server-safe", () => {
    const keys = Object.keys(emptySaca2Answers()).sort()
    expect([...SACA2_PHI_KEYS, ...SACA2_SERVER_SAFE_KEYS].sort()).toEqual(keys)
    expect([...SACA2_SERVER_SAFE_KEYS]).toEqual(["intake", "signature"])
  })
})

describe("emptySaca2Person defaults", () => {
  it("gives every new person field an empty default", () => {
    const p = emptySaca2Person()
    expect(p.streetAddress).toBe("")
    expect(p.noHomeAddress).toBe(false)
    expect(p.mailingSameAsStreet).toBe(true)
    expect(p.state).toBe("MA")
    expect(p.sexAtBirth).toBeNull()
    expect(p.hasSsn).toBeNull()
    expect(p.ssn).toBe("")
    expect(p.hasIncome).toBeNull()
    expect(p.expectedIncomeThisYear).toBeNull()
    expect(p.expectedIncomeNextYear).toBeNull()
    expect(p.livingArrangement).toBeNull()
  })
})
