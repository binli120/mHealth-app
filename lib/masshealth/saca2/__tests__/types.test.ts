/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  SACA2_FORM_CODE,
  SACA2_PHI_KEYS,
  SACA2_SCHEMA_VERSION,
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

  it("lists the PHI-bearing top-level keys", () => {
    expect([...SACA2_PHI_KEYS]).toEqual(["persons", "assets", "transfers", "supplements"])
    const keys = Object.keys(emptySaca2Answers())
    for (const phiKey of SACA2_PHI_KEYS) {
      expect(keys).toContain(phiKey)
    }
  })
})
