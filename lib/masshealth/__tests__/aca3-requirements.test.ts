/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import {
  ACA3_REQUIRED_QUESTIONS,
  ACA3_REQUIRED_QUESTION_SECTIONS_BY_STEP,
  getAca3QuestionCompletion,
  getMissingAca3Questions,
} from "@/lib/masshealth/aca3-requirements"

describe("lib/masshealth/aca3-requirements", () => {
  it("loads ACA-3 question requirements from JSON", () => {
    expect(ACA3_REQUIRED_QUESTIONS.length).toBeGreaterThan(200)
    expect(ACA3_REQUIRED_QUESTIONS[0]?.key).toMatch(/^aca3-q-/)
  })

  it("infers multiple answer input types", () => {
    const inputTypes = new Set(
      ACA3_REQUIRED_QUESTIONS.map((question) => question.inputType),
    )

    expect(inputTypes.has("text")).toBe(true)
    expect(inputTypes.has("yes_no")).toBe(true)
    expect(inputTypes.has("single_choice")).toBe(true)
  })

  it("distributes questions across workflow steps", () => {
    const countsByStep = [1, 2, 3, 4, 5].map((step) =>
      ACA3_REQUIRED_QUESTION_SECTIONS_BY_STEP[step as 1 | 2 | 3 | 4 | 5]
        .flatMap((section) => section.questions).length,
    )

    expect(countsByStep.some((count) => count > 0)).toBe(true)
    expect(countsByStep.reduce((sum, count) => sum + count, 0)).toBe(
      ACA3_REQUIRED_QUESTIONS.length,
    )
  })

  it("computes completion and missing questions", () => {
    const first = ACA3_REQUIRED_QUESTIONS[0]
    const second = ACA3_REQUIRED_QUESTIONS[1]

    const responses = {
      [first.key]: "Sample answer",
      [second.key]: "Yes",
    }

    const completion = getAca3QuestionCompletion(responses)
    const missing = getMissingAca3Questions(responses)

    expect(completion.total).toBe(ACA3_REQUIRED_QUESTIONS.length)
    expect(completion.answered).toBe(2)
    expect(completion.missing).toBe(ACA3_REQUIRED_QUESTIONS.length - 2)
    expect(missing.some((question) => question.key === first.key)).toBe(false)
  })
})
