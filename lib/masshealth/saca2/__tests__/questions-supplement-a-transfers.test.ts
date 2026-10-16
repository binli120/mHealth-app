/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { validateStep } from "@/lib/masshealth/saca2/questions"
import { emptySaca2Answers, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function answers(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
  const a = emptySaca2Answers()
  mutate(a)
  return a
}

function errs(a: Saca2Answers, ...prefixes: string[]): Record<string, string> {
  const all = validateStep("suppA", a, ON)
  return Object.fromEntries(Object.entries(all).filter(([key]) => prefixes.some((p) => key === p || key.startsWith(`${p}.`))))
}

const TRANSFER_KEYS = ["trust", "income", "assets", "deed", "addedToDeed", "loanOrNote", "annuity"] as const
const TRANSFERS = ["supplements.a.transferAnswers", "transfers"]
const DEPOSIT = "supplements.a.facilityDeposit"

const allNo = (a: Saca2Answers) => {
  for (const key of TRANSFER_KEYS) a.supplements.a.transferAnswers[key] = "no"
}

describe("Supplement A: resource transfers", () => {
  it("requires the seven transfer questions but not the life-estate question (6e)", () => {
    expect(Object.keys(errs(answers(), ...TRANSFERS)).sort()).toEqual(
      TRANSFER_KEYS.map((key) => `supplements.a.transferAnswers.${key}`).sort(),
    )
  })

  it("needs no transfer table when every transfer question is no", () => {
    expect(errs(answers(allNo), ...TRANSFERS)).toEqual({})
  })

  it("does not treat a Yes to 6e (lived in the home a year after buying a life estate) as a transfer", () => {
    const a = answers((x) => {
      allNo(x)
      x.supplements.a.transferAnswers.lifeEstateLivedOneYear = "yes"
    })
    expect(errs(a, ...TRANSFERS)).toEqual({})
  })

  it.each(TRANSFER_KEYS)("requires at least one transfer row when %s is yes", (key) => {
    const a = answers((x) => {
      allNo(x)
      x.supplements.a.transferAnswers[key] = "yes"
    })
    expect(errs(a, ...TRANSFERS)).toEqual({ transfers: "Add at least one." })
  })

  it("validates each transfer row and accepts a complete one", () => {
    const a = answers((x) => {
      allNo(x)
      x.supplements.a.transferAnswers.assets = "yes"
      x.transfers = [{ description: "", dateOfTransfer: null, transferredTo: "", relationship: "", amount: null }]
    })
    expect(Object.keys(errs(a, ...TRANSFERS)).sort()).toEqual([
      "transfers.0.amount",
      "transfers.0.dateOfTransfer",
      "transfers.0.description",
      "transfers.0.relationship",
      "transfers.0.transferredTo",
    ])
    a.transfers = [{ description: "Cash gift", dateOfTransfer: "2024-03-15", transferredTo: "Test Child", relationship: "child", amount: 30000 }]
    expect(errs(a, ...TRANSFERS)).toEqual({})
  })

  it("ignores leftover transfer rows after every answer flips back to no", () => {
    const a = answers((x) => {
      allNo(x)
      x.transfers = [{ description: "", dateOfTransfer: null, transferredTo: "", relationship: "", amount: null }]
    })
    expect(errs(a, ...TRANSFERS)).toEqual({})
  })
})

describe("Supplement A: deposit to a facility", () => {
  it("requires the opening question only", () => {
    expect(errs(answers(), DEPOSIT)).toEqual({ "supplements.a.facilityDeposit.gaveDeposit": "This question is required." })
    expect(errs(answers((x) => (x.supplements.a.facilityDeposit.gaveDeposit = "no")), DEPOSIT)).toEqual({})
  })

  it("asks for the facility, the amount, and whether the deposit is held or returned", () => {
    const a = answers((x) => (x.supplements.a.facilityDeposit.gaveDeposit = "yes"))
    expect(Object.keys(errs(a, DEPOSIT)).sort()).toEqual([
      "supplements.a.facilityDeposit.amount",
      "supplements.a.facilityDeposit.facilityAddress",
      "supplements.a.facilityDeposit.facilityName",
      "supplements.a.facilityDeposit.returned",
      "supplements.a.facilityDeposit.stillHeld",
    ])
  })

  it("asks who received a returned deposit only when it was returned", () => {
    const base = (x: Saca2Answers) => {
      x.supplements.a.facilityDeposit = {
        gaveDeposit: "yes",
        facilityName: "Example Residence",
        facilityAddress: "5 Elm St",
        amount: 3000,
        stillHeld: "no",
        returned: "no",
        returnedToName: "",
        returnedToAddress: "",
      }
    }
    expect(errs(answers(base), DEPOSIT)).toEqual({})
    const returned = answers((x) => {
      base(x)
      x.supplements.a.facilityDeposit.returned = "yes"
    })
    expect(errs(returned, DEPOSIT)).toEqual({
      "supplements.a.facilityDeposit.returnedToAddress": "This question is required.",
      "supplements.a.facilityDeposit.returnedToName": "This question is required.",
    })
  })

  it("ignores stale deposit details after the opening answer flips to no", () => {
    const a = answers((x) => {
      x.supplements.a.facilityDeposit.gaveDeposit = "no"
      x.supplements.a.facilityDeposit.returned = "yes"
    })
    expect(errs(a, DEPOSIT)).toEqual({})
  })
})
