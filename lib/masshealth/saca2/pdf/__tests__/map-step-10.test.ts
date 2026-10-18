/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it, vi } from "vitest"

import { completeHomeWithAllSupplements, completeRichHousehold, completeSingleSenior } from "../../__tests__/complete-answers"
import type { Saca2Answers } from "../../types"
import { STEP_10_ENTRIES } from "../field-map/step-10"
import { FIELD_MAP } from "../field-map"
import { getFieldInfo } from "../inventory"
import { NEVER_FILL } from "../never-fill"
import { fillSaca2Pdf } from "../pdf-fill"
import { readFilled, type FilledValues } from "./helpers/read-filled"

// each test fills the 1.7 MB template; the full suite runs many files in parallel
vi.setConfig({ testTimeout: 60_000 })

const ON = new Date("2026-10-13T12:00:00Z")
const SENTINEL = "STALE-SENTINEL"
const MAPPED = new Set(STEP_10_ENTRIES.flatMap((e) => e.fields))

/** Fills with the real map and reads back only the fields this region maps (checkboxes: only those selected). */
async function fillRegion(answers: Saca2Answers): Promise<FilledValues> {
  const { text, checks } = await readFilled(await fillSaca2Pdf(answers, null, ON))
  return {
    text: Object.fromEntries(Object.entries(text).filter(([name]) => MAPPED.has(name))),
    checks: Object.fromEntries(Object.entries(checks).filter(([name, state]) => MAPPED.has(name) && state !== null)),
  }
}

// literal field names, so a wrong map entry cannot hide behind a shared constant
const EMANCIPATED = "If you are under 18 years of age, are you an emancipated minor? "

function setResponsibleParty(a: Saca2Answers, text: string) {
  a.signing.responsibleParty = {
    firstName: `${text}Pat`,
    middleName: `${text}Q`,
    lastName: `${text}Guardian`,
    suffix: "Jr",
    ssn: "123-45-6789",
    relationship: `${text}Aunt`,
    dateOfBirth: "1980-03-02",
    street: `${text}12 Elm St`,
    apartment: "4B",
    city: `${text}Boston`,
    state: "ma",
    zip: "02108",
    county: `${text}Suffolk`,
    phone: "617-555-0142",
    phoneType: "mobile",
    secondPhone: "(617) 555-0199",
    email: "pat.guardian@example.test",
  }
}

/** A 17-year-old applicant (on ON) who is not emancipated and is signed for by a responsible party. */
function minorFixture(): Saca2Answers {
  const a = completeSingleSenior()
  a.persons[0].dateOfBirth = "2009-05-01"
  a.signing.emancipatedMinor = "no"
  a.signature.signedBy = "responsibleParty"
  a.signing.registerToVote = "yes"
  setResponsibleParty(a, "")
  return a
}

describe("Step 10 responsible party", () => {
  it("writes the emancipated-minor No and the whole responsible-party block for a minor applicant", async () => {
    expect(await fillRegion(minorFixture())).toEqual({
      text: {
        "First name_S": "Pat",
        "Middle name_S": "Q",
        "Last name_S": "Guardian",
        "Suffix_S": "Jr",
        "Social Security Number_S": "123-45-6789",
        "Relationship to you_S": "Aunt",
        "Date of birth_S": "03/02/1980",
        "Street address_S": "12 Elm St",
        "ApartmentUnit_S": "4B",
        "City_S": "Boston",
        "State_S": "MA",
        "Zip code_S": "02108",
        "County_S": "Suffolk",
        "Phone_S": "(617) 555-0142",
        "Phone type_S": "Mobile",
        "Second Phone_S": "(617) 555-0199",
        "Email_S": "pat.guardian@example.test",
      },
      checks: { [EMANCIPATED]: "No" },
    })
  })

  it("writes Yes for an emancipated minor and leaves the block empty", async () => {
    const a = minorFixture()
    a.signing.emancipatedMinor = "yes"
    a.signature.signedBy = "applicant"
    setResponsibleParty(a, SENTINEL)
    const out = await fillRegion(a)
    expect(out).toEqual({ text: {}, checks: { [EMANCIPATED]: "Yes" } })
  })

  it("leaves the whole block empty for an adult with stale responsible-party data", async () => {
    const a = completeSingleSenior()
    setResponsibleParty(a, SENTINEL)
    a.signing.emancipatedMinor = "no" // stale: hidden for an adult
    expect(await fillRegion(a)).toEqual({ text: {}, checks: {} })
  })

  it("leaves the block empty for a minor who turned out to be emancipated, whatever the leftovers", async () => {
    const a = minorFixture()
    a.signing.emancipatedMinor = "yes"
    a.signature.signedBy = "authorizedRepresentative"
    setResponsibleParty(a, SENTINEL)
    expect(await fillRegion(a)).toEqual({ text: {}, checks: { [EMANCIPATED]: "Yes" } })
  })

  it("shows the block when an adult chooses a responsible party; an invalid SSN and a missing phone type write nothing", async () => {
    const a = completeSingleSenior()
    a.signature.signedBy = "responsibleParty"
    setResponsibleParty(a, "")
    a.signing.responsibleParty.ssn = "12-3"
    a.signing.responsibleParty.phoneType = null
    const out = await fillRegion(a)
    expect(out.text["First name_S"]).toBe("Pat")
    expect(out.text["Social Security Number_S"]).toBeUndefined()
    expect(out.text["Phone type_S"]).toBeUndefined()
    expect(out.checks).toEqual({})
  })

  it("writes nothing for the 'who signs' choice: the form has no such box", () => {
    expect(STEP_10_ENTRIES.some((e) => e.source.kind === "answer" && e.source.path === "signature.signedBy")).toBe(false)
  })

  it("keeps the emancipated-minor on-states from the template (Yes left of No)", () => {
    const info = getFieldInfo(EMANCIPATED)!
    expect(info.type).toBe("checkbox")
    const [left, right] = [...info.widgets].sort((a, b) => a.rect[0] - b.rect[0])
    expect([left.onState, right.onState]).toEqual(["Yes", "No"])
  })
})

describe("never-fill sweep (signatures, dates, consents, voter, office use)", () => {
  const SWEPT = new Set(["signature", "signature-date", "consent", "voter", "office-use"])
  const swept = Object.entries(NEVER_FILL)
    .filter(([, v]) => SWEPT.has(v.reason))
    .map(([name]) => name)

  it("covers the signature, its date, the printed name and the voter box", () => {
    expect(swept).toEqual(expect.arrayContaining(["Print name", "Date", "would you like to apply to register to vote today?"]))
    expect(NEVER_FILL["Print name"].reason).toBe("signature")
    expect(NEVER_FILL.Date.reason).toBe("signature-date")
    expect(NEVER_FILL["would you like to apply to register to vote today?"].reason).toBe("voter")
    expect(swept.some((name) => FIELD_MAP.some((e) => e.fields.includes(name)))).toBe(false)
  })

  const fixtures: Array<[string, () => Saca2Answers]> = [
    ["completeRichHousehold", completeRichHousehold],
    ["completeHomeWithAllSupplements", completeHomeWithAllSupplements],
    ["the minor fixture", minorFixture],
  ]
  for (const [label, build] of fixtures) {
    it(`leaves every such field empty after filling ${label}`, async () => {
      const a = build()
      a.signing.registerToVote = "yes"
      const { text, checks } = await readFilled(await fillSaca2Pdf(a, null, ON))
      for (const name of swept) {
        expect(getFieldInfo(name), name).toBeDefined()
        if (getFieldInfo(name)!.type === "text") expect(text[name] ?? "", name).toBe("")
        else expect(checks[name] ?? null, name).toBeNull()
      }
      expect(JSON.stringify(text)).not.toContain(SENTINEL)
    })
  }
})
