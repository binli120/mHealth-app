/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { splitWizardState } from "@/lib/phi-token/token"
import { SACA2_STEPS } from "@/lib/masshealth/saca2/schema"
import { SACA2_SCHEMA_VERSION, emptySaca2Answers } from "@/lib/masshealth/saca2/types"
import {
  SERVER_DRAFT_MAX_STEP,
  buildSaca2Snapshot,
  createInitialWizardState,
  getWizardSteps,
  normalizeSaca2State,
  saca2WizardReducer,
} from "@/lib/masshealth/saca2/wizard-state"

const ON = new Date("2026-10-13T12:00:00Z")

describe("createInitialWizardState", () => {
  it("starts on intake with nothing dirty", () => {
    const s = createInitialWizardState()
    expect(s.currentStepId).toBe("intake")
    expect(s.furthestStepNumber).toBe(1)
    expect(s.dirty).toBe(false)
    expect(s.phiDirty).toBe(false)
    expect(s.schemaVersion).toBe(SACA2_SCHEMA_VERSION)
  })
})

describe("saca2WizardReducer", () => {
  it("set_answer updates the value immutably, clears that path's error, and marks both dirty flags", () => {
    const s0 = { ...createInitialWizardState(), errors: { "persons.0.firstName": "required", other: "x" } }
    const s1 = saca2WizardReducer(s0, { type: "set_answer", path: "persons.0.firstName", value: "Ada" })
    expect(s1.data.persons[0].firstName).toBe("Ada")
    expect(s0.data.persons[0].firstName).toBe("")
    expect(s1.errors).toEqual({ other: "x" })
    expect(s1.dirty).toBe(true)
    expect(s1.phiDirty).toBe(true)
  })

  it("set_step to person2 creates Person 2 once", () => {
    const s1 = saca2WizardReducer(createInitialWizardState(), { type: "set_step", stepId: "person2" })
    expect(s1.data.persons).toHaveLength(2)
    expect(s1.currentStepId).toBe("person2")
    const s2 = saca2WizardReducer(s1, { type: "set_step", stepId: "person1" })
    const s3 = saca2WizardReducer(s2, { type: "set_step", stepId: "person2" })
    expect(s3.data.persons).toHaveLength(2)
  })

  it("set_step never lowers the furthest step and clears errors", () => {
    let s = createInitialWizardState()
    s = saca2WizardReducer(s, { type: "set_step", stepId: "signature" })
    const furthest = s.furthestStepNumber
    expect(furthest).toBe(SACA2_STEPS.findIndex((x) => x.id === "signature") + 1)
    s = saca2WizardReducer({ ...s, errors: { a: "b" } }, { type: "set_step", stepId: "person1" })
    expect(s.furthestStepNumber).toBe(furthest)
    expect(s.errors).toEqual({})
  })

  it("mark_complete is idempotent", () => {
    let s = createInitialWizardState()
    s = saca2WizardReducer(s, { type: "mark_complete", stepId: "intake" })
    s = saca2WizardReducer(s, { type: "mark_complete", stepId: "intake" })
    expect(s.completedSteps).toEqual(["intake"])
  })

  it("mark_saved and mark_phi_secured clear only their own flag", () => {
    let s = saca2WizardReducer(createInitialWizardState(), { type: "set_answer", path: "persons.0.firstName", value: "A" })
    s = saca2WizardReducer(s, { type: "mark_saved" })
    expect(s.dirty).toBe(false)
    expect(s.phiDirty).toBe(true)
    s = saca2WizardReducer(s, { type: "mark_phi_secured" })
    expect(s.phiDirty).toBe(false)
  })

  it("hydrate replaces the state", () => {
    const hydrated = { ...createInitialWizardState(), currentStepId: "aian" as const }
    expect(saca2WizardReducer(createInitialWizardState(), { type: "hydrate", payload: hydrated }).currentStepId).toBe("aian")
  })
})

describe("getWizardSteps", () => {
  it("returns only visible steps that have content", () => {
    const answers = emptySaca2Answers()
    expect(getWizardSteps(answers, ON)).toEqual(["intake", "person1", "aian", "previousBills", "signature"])
    answers.persons[0].isLegallyMarried = "yes"
    expect(getWizardSteps(answers, ON)).toContain("person2")
  })
})

describe("buildSaca2Snapshot", () => {
  it("keeps the server draft step within 1..9 and equal to the furthest step when small", () => {
    let s = createInitialWizardState()
    expect(buildSaca2Snapshot(s).currentStep).toBe(1)
    s = saca2WizardReducer(s, { type: "set_step", stepId: "signature" })
    expect(buildSaca2Snapshot(s).currentStep).toBe(SERVER_DRAFT_MAX_STEP)
  })

  it("does not decrease when the user steps back", () => {
    let s = saca2WizardReducer(createInitialWizardState(), { type: "set_step", stepId: "aian" })
    const forward = buildSaca2Snapshot(s).currentStep as number
    s = saca2WizardReducer(s, { type: "set_step", stepId: "intake" })
    expect(buildSaca2Snapshot(s).currentStep).toBe(forward)
    expect(buildSaca2Snapshot(s).currentStepId).toBe("intake")
  })

  it("leaves only intake and signature after the PHI split", () => {
    let s = saca2WizardReducer(createInitialWizardState(), { type: "set_answer", path: "persons.0.firstName", value: "Ada" })
    s = saca2WizardReducer(s, { type: "set_answer", path: "persons.0.ssn", value: "123456789" })
    s = saca2WizardReducer(s, { type: "set_answer", path: "intake.programs.longTermCare", value: true })
    const { safeState, phiPayload } = splitWizardState(buildSaca2Snapshot(s))
    expect(Object.keys((safeState as { data: object }).data).sort()).toEqual(["intake", "signature"])
    expect(JSON.stringify(safeState)).not.toMatch(/Ada|123456789/)
    expect(JSON.stringify(phiPayload)).toMatch(/Ada/)
  })

  it("has no error or dirty flags", () => {
    const snap = buildSaca2Snapshot({ ...createInitialWizardState(), errors: { a: "b" }, dirty: true })
    expect(snap).not.toHaveProperty("errors")
    expect(snap).not.toHaveProperty("dirty")
    expect(typeof snap.persistedAt).toBe("string")
  })
})

describe("normalizeSaca2State", () => {
  it("round-trips a snapshot", () => {
    let s = saca2WizardReducer(createInitialWizardState(), { type: "set_answer", path: "persons.0.firstName", value: "Ada" })
    s = saca2WizardReducer(s, { type: "set_step", stepId: "aian" })
    const back = normalizeSaca2State(buildSaca2Snapshot(s))
    expect(back?.data.persons[0].firstName).toBe("Ada")
    expect(back?.currentStepId).toBe("aian")
    expect(back?.dirty).toBe(false)
    expect(back?.phiDirty).toBe(false)
  })

  it("rejects garbage, other schema versions, and missing data", () => {
    expect(normalizeSaca2State(null)).toBeNull()
    expect(normalizeSaca2State("x")).toBeNull()
    expect(normalizeSaca2State({})).toBeNull()
    expect(normalizeSaca2State({ schemaVersion: "saca2-2025-01", data: {} })).toBeNull()
  })

  it("fills missing keys, keeps a PHI-free server draft usable, and drops unknown step ids", () => {
    const serverDraft = {
      schemaVersion: SACA2_SCHEMA_VERSION,
      currentStepId: "not-a-step",
      furthestStepNumber: 3,
      completedSteps: ["intake", "bogus"],
      data: { intake: { programs: { longTermCare: true } }, signature: { signedBy: "applicant" } },
    }
    const s = normalizeSaca2State(serverDraft)!
    expect(s.currentStepId).toBe("intake")
    expect(s.completedSteps).toEqual(["intake"])
    expect(s.data.intake.programs.longTermCare).toBe(true)
    expect(s.data.intake.programs.masshealthHsn).toBe(false)
    expect(s.data.persons).toHaveLength(1)
    expect(s.data.persons[0].state).toBe("MA")
    expect(s.data.supplements.a.needsNursingFacility).toBeNull()
    expect(s.furthestStepNumber).toBe(3)
  })

  it("merges partial persons onto defaults and keeps a second person", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: { persons: [{ firstName: "A" }, { firstName: "B" }] },
    })!
    expect(s.data.persons).toHaveLength(2)
    expect(s.data.persons[1].firstName).toBe("B")
    expect(s.data.persons[1].mailingSameAsStreet).toBe(true)
  })

  it("keeps free-form maps such as asset gates and daily-living activities", () => {
    const s = normalizeSaca2State({
      schemaVersion: SACA2_SCHEMA_VERSION,
      data: {
        assets: { gates: { bankAccounts: "yes", trusts: "no" } },
        supplements: { c: { activities: { eating: { needsHandsOnHelp: "yes", timesPerDay: 3, daysPerWeek: 7 } } } },
      },
    })!
    expect(s.data.assets.gates).toEqual({ bankAccounts: "yes", trusts: "no" })
    expect(s.data.supplements.c.activities.eating?.timesPerDay).toBe(3)
  })

  it("never lets a hostile payload add prototype keys", () => {
    const hostile = JSON.parse(
      `{"schemaVersion":"${SACA2_SCHEMA_VERSION}","data":{"__proto__":{"polluted":true},"persons":[{"__proto__":{"polluted":true}}]}}`,
    )
    normalizeSaca2State(hostile)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  describe("corrupt payloads", () => {
    const norm = (data: unknown) => normalizeSaca2State({ schemaVersion: SACA2_SCHEMA_VERSION, data })!
    const def = emptySaca2Answers()

    it.each([
      ["data.intake:'x'", { intake: "x" }, (a: ReturnType<typeof emptySaca2Answers>) => a.intake, def.intake],
      ["data.intake:null", { intake: null }, (a: ReturnType<typeof emptySaca2Answers>) => a.intake, def.intake],
      ["data.intake.programs:null", { intake: { programs: null } }, (a: ReturnType<typeof emptySaca2Answers>) => a.intake.programs, def.intake.programs],
      ["data.assets.gates:'x'", { assets: { gates: "x" } }, (a: ReturnType<typeof emptySaca2Answers>) => a.assets.gates, def.assets.gates],
      ["data.supplements:5", { supplements: 5 }, (a: ReturnType<typeof emptySaca2Answers>) => a.supplements, def.supplements],
      ["persons[0].firstName:123", { persons: [{ firstName: 123 }] }, (a: ReturnType<typeof emptySaca2Answers>) => a.persons[0].firstName, def.persons[0].firstName],
      ["persons[0].hasSsn:{}", { persons: [{ hasSsn: {} }] }, (a: ReturnType<typeof emptySaca2Answers>) => a.persons[0].hasSsn, def.persons[0].hasSsn],
      ["persons[0].noHomeAddress:'yes'", { persons: [{ noHomeAddress: "yes" }] }, (a: ReturnType<typeof emptySaca2Answers>) => a.persons[0].noHomeAddress, def.persons[0].noHomeAddress],
      ["persons[0].income:'x'", { persons: [{ income: "x" }] }, (a: ReturnType<typeof emptySaca2Answers>) => a.persons[0].income, def.persons[0].income],
      ["data.transfers:{}", { transfers: {} }, (a: ReturnType<typeof emptySaca2Answers>) => a.transfers, def.transfers],
    ])("falls back to the default for %s", (_name, data, pick, expected) => {
      expect(() => norm(data)).not.toThrow()
      expect(pick(norm(data).data)).toEqual(expected)
    })

    it("keeps only strings and plain objects in arrays", () => {
      const s = norm({ persons: [{ income: [null, 1, { amount: 5 }] }] })
      expect(s.data.persons[0].income).toEqual([{ amount: 5 }])
    })

    it("accepts well-typed values", () => {
      const s = norm({
        persons: [{ isLegallyMarried: "yes", dateOfBirth: "1950-01-01", noHomeAddress: true }],
        assets: { gates: { bankAccounts: "yes" } },
      })
      expect(s.data.persons[0].isLegallyMarried).toBe("yes")
      expect(s.data.persons[0].dateOfBirth).toBe("1950-01-01")
      expect(s.data.persons[0].noHomeAddress).toBe(true)
      expect(s.data.assets.gates).toEqual({ bankAccounts: "yes" })
    })

    it("ignores inherited names such as toString", () => {
      const s = norm({ toString: "x", persons: [{ toString: "x" }] })
      expect(Object.hasOwn(s.data, "toString")).toBe(false)
      expect(Object.hasOwn(s.data.persons[0], "toString")).toBe(false)
    })

    it("drops forbidden keys at every level of the output", () => {
      const payload = JSON.parse(
        `{"persons":[{"constructor":{"x":1},"prototype":1,"income":[{"__proto__":{"p":1},"constructor":2,"amount":5}]}],"assets":{"gates":{"__proto__":{"p":1},"constructor":"yes","prototype":"no","trusts":"no"}}}`,
      )
      const s = norm(payload)
      const forbidden = ["__proto__", "constructor", "prototype"]
      const has = (o: object, k: string) => Object.hasOwn(o, k)
      forbidden.forEach((k) => {
        expect(has(s.data.persons[0], k)).toBe(false)
        expect(has(s.data.assets.gates, k)).toBe(false)
        expect(has(s.data.persons[0].income[0] as object, k)).toBe(false)
      })
      expect(s.data.persons[0].income[0]).toEqual({ amount: 5 })
      expect(s.data.assets.gates).toEqual({ trusts: "no" })
    })
  })
})
