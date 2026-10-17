/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { getAtPath } from "@/lib/masshealth/saca2/answer-paths"
import {
  IMPLEMENTED_STEP_IDS,
  STEP_TITLES,
  getStepContent,
  getStepPersonIndex,
  validateStep,
} from "@/lib/masshealth/saca2/questions"
import {
  IMMIGRATION_DOCUMENT_OPTIONS,
  IMMIGRATION_STATUS_OPTIONS,
} from "@/lib/masshealth/saca2/questions/immigration-options"
import { resolveQuestionPath, type Saca2Question } from "@/lib/masshealth/saca2/questions/types"
import { SACA2_STEPS } from "@/lib/masshealth/saca2/schema"
import { emptySaca2Answers, emptySaca2Person, type Saca2Answers } from "@/lib/masshealth/saca2/types"

const ON = new Date("2026-10-13T12:00:00Z")

function allQuestions(stepId: Parameters<typeof getStepContent>[0]): Saca2Question[] {
  const content = getStepContent(stepId)
  return content ? content.sections.flatMap((section) => section.questions) : []
}

describe("step registry", () => {
  it("implements exactly the steps listed here (extend the list as steps gain content)", () => {
    const withContent = ["additionalCoverage", "aian", "ard", "assets", "healthInsurance", "hra", "intake", "irs4506", "pca", "person1", "person2", "previousBills", "signature", "suppA", "suppB", "suppC", "suppD"]
    expect([...IMPLEMENTED_STEP_IDS].sort()).toEqual([...withContent].sort())
    for (const id of IMPLEMENTED_STEP_IDS) expect(getStepContent(id)).not.toBeNull()
    expect(getStepContent("nope" as never)).toBeNull()
  })

  it("has an English title for every step", () => {
    for (const step of SACA2_STEPS) expect(STEP_TITLES[step.id].length).toBeGreaterThan(0)
  })

  it("maps person steps to person indexes", () => {
    expect(getStepPersonIndex("person1")).toBe(0)
    expect(getStepPersonIndex("person2")).toBe(1)
    expect(getStepPersonIndex("intake")).toBe(0)
  })
})

describe("question definitions", () => {
  it.each([...IMPLEMENTED_STEP_IDS])("%s: ids are unique and every path resolves on empty answers", (stepId) => {
    const content = getStepContent(stepId)!
    const questions = allQuestions(stepId)
    const ids = questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)

    const answers = emptySaca2Answers()
    answers.persons.push(emptySaca2Person())
    for (const q of questions) {
      const path = resolveQuestionPath(content.scope, 1, q.path)
      expect(getAtPath(answers, path), `${stepId}:${q.path}`).not.toBeUndefined()
    }
  })

  it("lists the eligible immigration statuses and document types from form page 32", () => {
    expect(IMMIGRATION_STATUS_OPTIONS.map((o) => o.label)).toContain("Lawful permanent resident")
    expect(IMMIGRATION_DOCUMENT_OPTIONS.map((o) => o.label)).toContain("Foreign passport")
    for (const list of [IMMIGRATION_STATUS_OPTIONS, IMMIGRATION_DOCUMENT_OPTIONS]) {
      expect(new Set(list.map((o) => o.value)).size).toBe(list.length)
      for (const o of list) expect(o.value).toMatch(/^[a-z0-9-]+$/)
    }
  })
})

describe("validateStep: intake", () => {
  it("requires at least one program box", () => {
    const answers = emptySaca2Answers()
    expect(Object.keys(validateStep("intake", answers, ON))).toEqual(["intake.programs.masshealthHsn"])
    answers.intake.programs.longTermCare = true
    expect(validateStep("intake", answers, ON)).toEqual({})
  })
})

describe("validateStep: person1", () => {
  function basicPerson1(mutate: (a: Saca2Answers) => void = () => {}): Saca2Answers {
    const a = emptySaca2Answers()
    const p = a.persons[0]
    p.firstName = "Edna"
    p.lastName = "Testcase"
    p.dateOfBirth = "1950-04-02"
    p.sexAtBirth = "female"
    p.applyingForCoverage = "yes"
    p.noHomeAddress = false
    p.streetAddress = "1 Example St"
    p.city = "Testville"
    p.state = "MA"
    p.zip = "02101"
    p.inInstitution = "no"
    p.mobilePhone = "6175550100"
    p.hasSsn = "no"
    p.noSsnReason = "justApplied"
    p.usCitizenOrNational = "yes"
    p.naturalizedCitizen = "no"
    p.residentOfMassachusetts = "yes"
    p.caregiverOfChildUnder19 = "no"
    p.isLegallyMarried = "no"
    p.hasDisability = "no"
    p.everGotSsi = "no"
    p.hasMedicareOrSsiOrSsdi = "yes"
    p.hasIncome = "no"
    p.tax.agreesToFileIfAptc = "no"
    p.tax.claimedAsDependent = "no"
    p.tax.filingSeparatelyAbuse = "no"
    mutate(a)
    return a
  }

  it("flags the required basics on an empty form", () => {
    const errors = validateStep("person1", emptySaca2Answers(), ON)
    for (const key of [
      "persons.0.firstName",
      "persons.0.lastName",
      "persons.0.dateOfBirth",
      "persons.0.sexAtBirth",
      "persons.0.applyingForCoverage",
      "persons.0.inInstitution",
      "persons.0.mobilePhone",
    ]) {
      expect(errors[key], key).toBeDefined()
    }
  })

  it("passes a complete single applicant", () => {
    expect(validateStep("person1", basicPerson1(), ON)).toEqual({})
  })

  it("does not ask for hidden answers: no SSN field when 'no SSN', no mailing when same as street, no immigration when a citizen", () => {
    const errors = validateStep("person1", basicPerson1(), ON)
    expect(errors["persons.0.ssn"]).toBeUndefined()
    expect(errors["persons.0.mailingAddress"]).toBeUndefined()
    expect(errors["persons.0.immigrationStatus"]).toBeUndefined()
  })

  it("requires the SSN (and a valid one) when the person has one", () => {
    const missing = validateStep("person1", basicPerson1((a) => { a.persons[0].hasSsn = "yes" }), ON)
    expect(missing["persons.0.ssn"]).toMatch(/required/i)
    const bad = validateStep("person1", basicPerson1((a) => { a.persons[0].hasSsn = "yes"; a.persons[0].ssn = "12" }), ON)
    expect(bad["persons.0.ssn"]).toMatch(/9-digit/i)
    const good = validateStep("person1", basicPerson1((a) => { a.persons[0].hasSsn = "yes"; a.persons[0].ssn = "123-45-6789" }), ON)
    expect(good["persons.0.ssn"]).toBeUndefined()
  })

  it("requires a mailing address when there is no home address or mailing differs", () => {
    const noHome = validateStep("person1", basicPerson1((a) => { a.persons[0].noHomeAddress = true }), ON)
    expect(noHome["persons.0.mailingAddress"]).toMatch(/required/i)
    expect(noHome["persons.0.streetAddress"]).toBeUndefined()
    const differs = validateStep("person1", basicPerson1((a) => { a.persons[0].mailingSameAsStreet = false }), ON)
    expect(differs["persons.0.mailingAddress"]).toMatch(/required/i)
  })

  it("requires immigration details only for non-citizens with an eligible status", () => {
    const nonCitizen = validateStep("person1", basicPerson1((a) => {
      a.persons[0].usCitizenOrNational = "no"
      a.persons[0].naturalizedCitizen = null
    }), ON)
    expect(nonCitizen["persons.0.hasEligibleImmigrationStatus"]).toMatch(/required/i)
    const eligible = validateStep("person1", basicPerson1((a) => {
      a.persons[0].usCitizenOrNational = "no"
      a.persons[0].naturalizedCitizen = null
      a.persons[0].hasEligibleImmigrationStatus = "yes"
    }), ON)
    expect(eligible["persons.0.immigrationStatus"]).toMatch(/required/i)
    expect(eligible["persons.0.immigrationDocumentType"]).toMatch(/required/i)
  })

  it("rejects a date of birth in the future or before 1900", () => {
    expect(validateStep("person1", basicPerson1((a) => { a.persons[0].dateOfBirth = "2027-01-01" }), ON)["persons.0.dateOfBirth"]).toMatch(/future/i)
    expect(validateStep("person1", basicPerson1((a) => { a.persons[0].dateOfBirth = "1899-12-31" }), ON)["persons.0.dateOfBirth"]).toMatch(/1900/)
  })

  it("only asks for income detail when the person has income", () => {
    const noIncome = validateStep("person1", basicPerson1(), ON)
    expect(noIncome["persons.0.expectedIncomeThisYear"]).toBeUndefined()
    const withIncome = validateStep("person1", basicPerson1((a) => { a.persons[0].hasIncome = "yes" }), ON)
    expect(withIncome["persons.0.income"]).toMatch(/at least one/i)
    expect(withIncome["persons.0.expectedIncomeThisYear"]).toMatch(/required/i)
  })

  it("skips the coverage-only questions when the person is not applying", () => {
    const errors = validateStep("person1", basicPerson1((a) => {
      a.persons[0].applyingForCoverage = "no"
      a.persons[0].hasSsn = null
      a.persons[0].usCitizenOrNational = null
      a.persons[0].residentOfMassachusetts = null
    }), ON)
    expect(errors["persons.0.hasSsn"]).toBeUndefined()
    expect(errors["persons.0.usCitizenOrNational"]).toBeUndefined()
  })
})

describe("validateStep: person2", () => {
  it("also requires the relationship to Person 1 and whether they live together", () => {
    const answers = emptySaca2Answers()
    answers.persons.push(emptySaca2Person())
    const errors = validateStep("person2", answers, ON)
    expect(errors["persons.1.relationshipToPerson1"]).toMatch(/required/i)
    expect(errors["persons.1.livesWithPerson1"]).toMatch(/required/i)
    expect(errors["persons.1.firstName"]).toMatch(/required/i)
  })

  it("does not ask Person 1 for a relationship", () => {
    expect(validateStep("person1", emptySaca2Answers(), ON)["persons.0.relationshipToPerson1"]).toBeUndefined()
  })
})

describe("validateStep: aian, previousBills, signature", () => {
  it("each requires its single answer", () => {
    expect(validateStep("aian", emptySaca2Answers(), ON)["aian.anyMember"]).toMatch(/required/i)
    expect(validateStep("previousBills", emptySaca2Answers(), ON)["previousMedicalBills.hasBills"]).toMatch(/required/i)
    expect(validateStep("signature", emptySaca2Answers(), ON)["signature.signedBy"]).toMatch(/required/i)
  })

  it("returns no errors for steps without content", () => {
    expect(validateStep("nope" as never, emptySaca2Answers(), ON)).toEqual({})
  })
})
