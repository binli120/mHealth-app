/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { emptySaca2Answers } from "@/lib/masshealth/saca2/types"
import type { Saca2QuestionContext } from "@/lib/masshealth/saca2/questions/types"
import {
  checkbox,
  date,
  email,
  money,
  opts,
  phone,
  repeater,
  select,
  ssn,
  text,
  yesNo,
} from "@/lib/masshealth/saca2/questions/builders"
import { isEmptyValue, validateQuestions, validateValue } from "@/lib/masshealth/saca2/questions/validate"

function ctx(overrides: Partial<Saca2QuestionContext> = {}): Saca2QuestionContext {
  return { answers: emptySaca2Answers(), personIndex: 0, on: new Date("2026-10-13T12:00:00Z"), ...overrides }
}

describe("builders", () => {
  it("use the path as the id", () => {
    const q = text("firstName", "First name", { required: true })
    expect(q).toMatchObject({ id: "firstName", path: "firstName", kind: "text", required: true })
  })
})

describe("isEmptyValue", () => {
  it("treats null, undefined, blank strings, and empty arrays as empty", () => {
    expect(isEmptyValue("text", null)).toBe(true)
    expect(isEmptyValue("text", undefined)).toBe(true)
    expect(isEmptyValue("text", "   ")).toBe(true)
    expect(isEmptyValue("repeater", [])).toBe(true)
    expect(isEmptyValue("text", "a")).toBe(false)
    expect(isEmptyValue("money", 0)).toBe(false)
  })

  it("treats an unchecked checkbox as empty", () => {
    expect(isEmptyValue("checkbox", false)).toBe(true)
    expect(isEmptyValue("checkbox", true)).toBe(false)
  })
})

describe("validateValue", () => {
  it("requires a value only when the question is required", () => {
    expect(validateValue(text("a", "A", { required: true }), "", ctx())).toMatch(/required/i)
    expect(validateValue(text("a", "A"), "", ctx())).toBeNull()
    expect(validateValue(yesNo("a", "A", { required: true }), null, ctx())).toMatch(/required/i)
  })

  it("supports conditional required", () => {
    const q = text("a", "A", { required: (c) => c.personIndex === 1 })
    expect(validateValue(q, "", ctx({ personIndex: 0 }))).toBeNull()
    expect(validateValue(q, "", ctx({ personIndex: 1 }))).toMatch(/required/i)
  })

  it("validates SSN as exactly nine digits, ignoring dashes and spaces", () => {
    expect(validateValue(ssn("s", "SSN"), "123-45-6789", ctx())).toBeNull()
    expect(validateValue(ssn("s", "SSN"), "123 45 6789", ctx())).toBeNull()
    expect(validateValue(ssn("s", "SSN"), "12345678", ctx())).toMatch(/9-digit/i)
  })

  it("validates phone as ten digits and email shape", () => {
    expect(validateValue(phone("p", "Phone"), "(617) 555-0100", ctx())).toBeNull()
    expect(validateValue(phone("p", "Phone"), "555-0100", ctx())).toMatch(/10-digit/i)
    expect(validateValue(email("e", "Email"), "a@b.co", ctx())).toBeNull()
    expect(validateValue(email("e", "Email"), "nope", ctx())).toMatch(/valid email/i)
  })

  it("validates dates as real ISO calendar dates", () => {
    expect(validateValue(date("d", "D"), "2026-02-28", ctx())).toBeNull()
    expect(validateValue(date("d", "D"), "2026-02-30", ctx())).toMatch(/valid date/i)
    expect(validateValue(date("d", "D"), "02/03/2026", ctx())).toMatch(/valid date/i)
  })

  it("validates money as a finite number that is not negative", () => {
    expect(validateValue(money("m", "M"), 0, ctx())).toBeNull()
    expect(validateValue(money("m", "M"), 12.5, ctx())).toBeNull()
    expect(validateValue(money("m", "M"), -1, ctx())).toMatch(/0 or more/i)
    expect(validateValue(money("m", "M"), Number.NaN, ctx())).toMatch(/0 or more/i)
  })

  it("restricts select to its options and yesNo to yes/no", () => {
    const q = select("s", "S", opts([["a", "A"], ["b", "B"]]))
    expect(validateValue(q, "a", ctx())).toBeNull()
    expect(validateValue(q, "z", ctx())).toMatch(/listed options/i)
    expect(validateValue(yesNo("y", "Y"), "maybe", ctx())).toMatch(/yes or no/i)
  })

  it("requires a checkbox to be checked only when required", () => {
    expect(validateValue(checkbox("c", "C", { required: true }), false, ctx())).toMatch(/required/i)
    expect(validateValue(checkbox("c", "C"), false, ctx())).toBeNull()
  })

  it("runs a custom validator after the built-in checks", () => {
    const q = text("a", "A", { validate: (v) => (v === "bad" ? "No bad values." : null) })
    expect(validateValue(q, "bad", ctx())).toBe("No bad values.")
    expect(validateValue(q, "good", ctx())).toBeNull()
  })
})

describe("validateQuestions", () => {
  it("skips questions whose visibleWhen is false, even if required", () => {
    const questions = [
      yesNo("persons.0.hasSsn", "Has SSN?", { required: true }),
      ssn("persons.0.ssn", "SSN", { required: true, visibleWhen: (c) => c.answers.persons[0].hasSsn === "yes" }),
    ]
    const answers = emptySaca2Answers()
    answers.persons[0].hasSsn = "no"
    const errors = validateQuestions(questions, ctx({ answers }), "root", 0)
    expect(Object.keys(errors)).toEqual([])
  })

  it("keys errors by absolute path for person scope", () => {
    const questions = [text("firstName", "First", { required: true })]
    const errors = validateQuestions(questions, ctx(), "person", 1)
    expect(errors).toEqual({ "persons.1.firstName": "This question is required." })
  })

  it("requires at least one repeater item when the repeater is required, and validates items by index", () => {
    const itemQuestions = [money("amount", "Amount", { required: true }), text("note", "Note")]
    const rep = repeater("income", "Income", {
      questions: itemQuestions,
      emptyItem: () => ({ amount: null, note: "" }),
      addLabel: "Add income",
      itemTitle: "Income source",
      maxItems: 3,
    }, { required: true })

    const none = emptySaca2Answers()
    expect(validateQuestions([rep], ctx({ answers: none }), "person", 0)).toEqual({
      "persons.0.income": "Add at least one.",
    })

    const some = emptySaca2Answers()
    ;(some.persons[0].income as unknown[]) = [
      { amount: 10, note: "" },
      { amount: null, note: "" },
    ]
    expect(validateQuestions([rep], ctx({ answers: some }), "person", 0)).toEqual({
      "persons.0.income.1.amount": "This question is required.",
    })
  })
})
