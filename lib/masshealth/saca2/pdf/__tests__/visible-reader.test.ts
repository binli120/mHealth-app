/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"

import {
  completeFacilityCouple,
  completeHomeWithAllSupplements,
  completeRichHousehold,
  completeSingleSenior,
} from "../../__tests__/complete-answers"
import { emptySaca2Person } from "../../types"
import { isStepVisible } from "../../visibility"
import { createVisibleReader } from "../visible-reader"

const ON = new Date("2026-10-13T12:00:00Z")

describe("createVisibleReader: answers", () => {
  it("reads a visible Person 1 answer", () => {
    const r = createVisibleReader(completeSingleSenior(), ON)
    expect(r.get({ kind: "answer", stepId: "person1", path: "firstName" })).toBe("Edna")
    expect(r.get({ kind: "answer", stepId: "person1", path: "dateOfBirth" })).toBe("1950-04-02")
  })

  it("reads a root-scope answer", () => {
    const r = createVisibleReader(completeSingleSenior(), ON)
    expect(r.get({ kind: "answer", stepId: "aian", path: "aian.anyMember" })).toBe("no")
  })

  it("hides a stale SSN once the question's gate is closed, and shows it while open", () => {
    const a = completeRichHousehold()
    expect(a.persons[0].hasSsn).toBe("yes")
    const src = { kind: "answer", stepId: "person1", path: "ssn" } as const
    expect(createVisibleReader(a, ON).get(src)).toBe("123-45-6789")

    a.persons[0].hasSsn = "no"
    expect(createVisibleReader(a, ON).get(src)).toBeUndefined()
  })

  it("hides every Person 1 answer when the person is not applying", () => {
    const a = completeRichHousehold()
    const src = { kind: "answer", stepId: "person1", path: "ssn" } as const
    expect(createVisibleReader(a, ON).get(src)).toBe("123-45-6789")
    a.persons[0].applyingForCoverage = "no"
    expect(createVisibleReader(a, ON).get(src)).toBeUndefined()
    // an ungated question stays readable
    expect(createVisibleReader(a, ON).get({ kind: "answer", stepId: "person1", path: "firstName" })).toBe("Maria")
  })

  it("selects the Person 2 block with `person: 1`, via the person2 step's visibility", () => {
    const a = completeRichHousehold()
    const p2 = { kind: "answer", stepId: "person1", path: "firstName", person: 1 } as const
    const direct = { kind: "answer", stepId: "person2", path: "firstName" } as const
    const name = a.persons[1].firstName
    expect(name).not.toBe("")
    expect(createVisibleReader(a, ON).get(p2)).toBe(name)
    expect(createVisibleReader(a, ON).get(direct)).toBe(name)

    // Person 1 no longer married and Person 2 is blank: step hidden, so nothing reads
    a.persons[0].isLegallyMarried = "no"
    a.persons[1] = emptySaca2Person()
    expect(createVisibleReader(a, ON).get(p2)).toBeUndefined()
    expect(createVisibleReader(a, ON).get(direct)).toBeUndefined()
  })

  it("returns undefined when the person block does not exist", () => {
    const a = completeSingleSenior()
    a.persons[0].isLegallyMarried = "yes" // makes the person2 step visible with no block
    expect(a.persons).toHaveLength(1)
    const r = createVisibleReader(a, ON)
    expect(r.get({ kind: "answer", stepId: "person2", path: "firstName" })).toBeUndefined()
  })

  it("gates by step: Supplement A answers are hidden when the supplement is not shown", () => {
    const src = { kind: "answer", stepId: "suppA", path: "supplements.a.taxReturnsFiled" } as const
    const hidden = completeSingleSenior()
    hidden.supplements.a.taxReturnsFiled = "bothYears"
    expect(isStepVisible("suppA", hidden, ON)).toBe(false)
    expect(createVisibleReader(hidden, ON).get(src)).toBeUndefined()

    const shown = completeFacilityCouple()
    expect(isStepVisible("suppA", shown, ON)).toBe(true)
    expect(createVisibleReader(shown, ON).get(src)).toBe("bothYears")
  })

  it("throws for an unknown path, naming the path only", () => {
    const r = createVisibleReader(completeSingleSenior(), ON)
    expect(() => r.get({ kind: "answer", stepId: "person1", path: "firstNmae" })).toThrow(/firstNmae/)
    expect(() => r.get({ kind: "answer", stepId: "person1", path: "firstNmae" })).not.toThrow(/Edna/)
  })

  it("throws when a step has no question content or `person` is used on a root step", () => {
    const r = createVisibleReader(completeSingleSenior(), ON)
    expect(() => r.get({ kind: "answer", stepId: "aian", path: "aian.anyMember", person: 1 })).toThrow(/person/)
  })

  it("does not resolve derived sources", () => {
    const r = createVisibleReader(completeSingleSenior(), ON)
    expect(() => r.get({ kind: "derived", id: "p1.fullName" })).toThrow(/derived/)
  })
})

describe("createVisibleReader: repeater rows", () => {
  const bank = (index: number, key: string) =>
    ({ kind: "row", stepId: "assets", path: "assets.bankAccounts", index, key }) as const

  it("counts rows when the gate is yes and returns 0 when the gate is flipped to no", () => {
    const a = completeFacilityCouple()
    expect(a.assets.bankAccounts).toHaveLength(1)
    expect(createVisibleReader(a, ON).rows("assets", "assets.bankAccounts")).toBe(1)
    a.assets.gates.bankAccounts = "no"
    a.assets.gates.retirementAccounts = "no"
    a.assets.gates.closedAccounts = "no"
    expect(createVisibleReader(a, ON).rows("assets", "assets.bankAccounts")).toBe(0)
  })

  it("reads row values only while the repeater is visible", () => {
    const a = completeFacilityCouple()
    expect(createVisibleReader(a, ON).get(bank(0, "institution"))).toBe("Example Bank")
    a.assets.gates.bankAccounts = "no"
    a.assets.gates.retirementAccounts = "no"
    a.assets.gates.closedAccounts = "no"
    expect(createVisibleReader(a, ON).get(bank(0, "institution"))).toBeUndefined()
  })

  it("hides item questions by item context, in both directions", () => {
    const a = completeFacilityCouple()
    a.assets.bankAccounts[0].balanceWhenClosed = 300
    a.assets.bankAccounts[0].open = true
    let r = createVisibleReader(a, ON)
    expect(r.get(bank(0, "balanceWhenClosed"))).toBeUndefined() // open account: stale value hidden
    expect(r.get(bank(0, "currentBalance"))).toBe(54000)

    a.assets.bankAccounts[0].open = false
    r = createVisibleReader(a, ON)
    expect(r.get(bank(0, "balanceWhenClosed"))).toBe(300)
    expect(r.get(bank(0, "currentBalance"))).toBeUndefined() // closed account: current balance hidden
  })

  it("selects an item question by id when several share one row field (income `description`)", () => {
    const a = completeRichHousehold()
    const row = (index: number, key: string) =>
      ({ kind: "row", stepId: "person1", path: "income", index, key, person: 0 }) as const
    // row 1 is self-employment, row 2 a pension: each reads the same stored `description` under its own variant
    let r = createVisibleReader(a, ON)
    expect(r.get(row(1, "description"))).toBe("House cleaning")
    expect(r.get(row(2, "description.pension"))).toBe("Brazilian pension fund")
    expect(r.get(row(2, "description"))).toBeUndefined() // the self-employment wording is hidden on a pension row
    expect(r.get(row(1, "description.pension"))).toBeUndefined()

    a.persons[0].income[2].kind = "otherTaxable"
    r = createVisibleReader(a, ON)
    expect(r.get(row(2, "description.pension"))).toBeUndefined()
    expect(r.get(row(2, "description.otherTaxable"))).toBe("Brazilian pension fund")
  })

  it("returns undefined for a row index that does not exist", () => {
    const a = completeFacilityCouple()
    expect(createVisibleReader(a, ON).get(bank(5, "institution"))).toBeUndefined()
  })

  it("throws for an unknown repeater path or item key, naming the path or key only", () => {
    const r = createVisibleReader(completeFacilityCouple(), ON)
    expect(() => r.get({ kind: "row", stepId: "assets", path: "assets.nope", index: 0, key: "x" })).toThrow(/assets\.nope/)
    expect(() => r.get(bank(0, "institutoin"))).toThrow(/institutoin/)
    expect(() => r.rows("assets", "assets.nope")).toThrow(/assets\.nope/)
    // a plain (non-repeater) question is not a repeater
    expect(() => r.rows("assets", "assets.gates.bankAccounts")).toThrow(/assets\.gates\.bankAccounts/)
  })

  it("gates rows by step: IRS 4506 years are hidden unless the attachment is shown", () => {
    const years = (i: number) =>
      ({ kind: "row", stepId: "irs4506", path: "attachments.irs4506.yearsRequested", index: i, key: "periodEnd" }) as const
    const a = completeFacilityCouple()
    a.attachments.irs4506.yearsRequested = [{ periodEnd: "2025-12-31" }]
    a.supplements.a.hasCopiesOfTaxReturns = "no"
    expect(isStepVisible("irs4506", a, ON)).toBe(true)
    expect(createVisibleReader(a, ON).rows("irs4506", "attachments.irs4506.yearsRequested")).toBe(1)
    expect(createVisibleReader(a, ON).get(years(0))).toBe("2025-12-31")

    a.supplements.a.hasCopiesOfTaxReturns = "yes"
    expect(isStepVisible("irs4506", a, ON)).toBe(false)
    expect(createVisibleReader(a, ON).rows("irs4506", "attachments.irs4506.yearsRequested")).toBe(0)
    expect(createVisibleReader(a, ON).get(years(0))).toBeUndefined()
  })

  it("reads person-scope repeater rows per person and respects the repeater's own gate", () => {
    const kids = (i: number, person?: 0 | 1) =>
      ({ kind: "row", stepId: "person1", path: "caregiverChildren", index: i, key: "name", person }) as const
    const a = completeRichHousehold()
    a.persons[1].caregiverOfChildUnder19 = "yes"
    a.persons[1].caregiverChildren = [{ name: "Kid Two", dateOfBirth: "2015-01-01" }]
    a.persons[0].caregiverOfChildUnder19 = "no"
    a.persons[0].caregiverChildren = [{ name: "Stale Kid", dateOfBirth: "2014-01-01" }]
    const r = createVisibleReader(a, ON)
    expect(r.rows("person1", "caregiverChildren")).toBe(0)
    expect(r.get(kids(0))).toBeUndefined()
    expect(r.rows("person1", "caregiverChildren", 1)).toBe(1)
    expect(r.get(kids(0, 1))).toBe("Kid Two")

    a.persons[0].caregiverOfChildUnder19 = "yes"
    const r2 = createVisibleReader(a, ON)
    expect(r2.rows("person1", "caregiverChildren")).toBe(1)
    expect(r2.get(kids(0))).toBe("Stale Kid")
  })
})

describe("createVisibleReader: isVisible", () => {
  const health = (person: 0 | 1) => ({ kind: "answer", stepId: "suppC", path: `supplements.c.${person}.healthProblems.0` }) as const

  it("is true for a shown question whatever its value, false when its step or gate hides it", () => {
    const a = completeHomeWithAllSupplements()
    a.supplements.c[0].healthProblems = ["", "", ""]
    expect(createVisibleReader(a, ON).isVisible(health(0))).toBe(true)
    // Person 2 has not been through the PCA chain, so her Supplement C questions are not shown
    expect(createVisibleReader(a, ON).isVisible(health(1))).toBe(false)
    a.pca.needsPca = "no"
    expect(createVisibleReader(a, ON).isVisible(health(0))).toBe(false)
  })

  it("throws for an unknown path, naming the path only", () => {
    expect(() => createVisibleReader(completeSingleSenior(), ON).isVisible({ kind: "answer", stepId: "suppC", path: "nope" })).toThrow(/nope/)
  })
})
