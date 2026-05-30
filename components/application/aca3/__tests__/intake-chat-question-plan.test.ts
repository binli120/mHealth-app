/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import {
  buildIntakeQuestions,
  computeAnsweredIntakeQuestionIds,
  createInitialIntakeData,
  getWizardStepForIntakeProgress,
  parseIntakeAnswerValue,
  writeIntakeQuestionValue,
} from "@/components/application/aca3/intake-chat"

describe("IntakeChat question plan", () => {
  it("includes wizard income widgets after the applicant reports income", () => {
    let data = createInitialIntakeData()
    let questions = buildIntakeQuestions(data)
    const hasIncomeQuestion = questions.find((question) => question.field.id === "has_income")
    expect(hasIncomeQuestion).toBeDefined()

    data = writeIntakeQuestionValue(
      data,
      hasIncomeQuestion!,
      parseIntakeAnswerValue(hasIncomeQuestion!.field, "Yes"),
    )
    questions = buildIntakeQuestions(data)

    expect(questions.map((question) => question.id)).toEqual(
      expect.arrayContaining([
        "complex:person:0:income:employment_jobs:count",
        "complex:person:0:income:other_income:selected",
        "complex:person:0:income:deductions:selected",
      ]),
    )
  })

  it("expands repeatable employment rows into the same fields the wizard renders", () => {
    let data = createInitialIntakeData()
    let questions = buildIntakeQuestions(data)
    const hasIncomeQuestion = questions.find((question) => question.field.id === "has_income")
    expect(hasIncomeQuestion).toBeDefined()

    data = writeIntakeQuestionValue(
      data,
      hasIncomeQuestion!,
      parseIntakeAnswerValue(hasIncomeQuestion!.field, "Yes"),
    )
    questions = buildIntakeQuestions(data)
    const employmentCountQuestion = questions.find((question) => question.id.endsWith(":employment_jobs:count"))
    expect(employmentCountQuestion).toBeDefined()

    data = writeIntakeQuestionValue(
      data,
      employmentCountQuestion!,
      parseIntakeAnswerValue(employmentCountQuestion!.field, "1"),
    )
    questions = buildIntakeQuestions(data)

    expect(questions.map((question) => question.id)).toEqual(
      expect.arrayContaining([
        "complex:person:0:income:employment_jobs:0:employer_name_address",
        "complex:person:0:income:employment_jobs:0:wages_amount",
        "complex:person:0:income:employment_jobs:0:wages_frequency",
        "complex:person:0:income:employment_jobs:0:hours_per_week",
      ]),
    )
  })

  it("asks follow-up amount and frequency questions for selected other income", () => {
    let data = createInitialIntakeData()
    let questions = buildIntakeQuestions(data)
    const hasIncomeQuestion = questions.find((question) => question.field.id === "has_income")
    expect(hasIncomeQuestion).toBeDefined()

    data = writeIntakeQuestionValue(
      data,
      hasIncomeQuestion!,
      parseIntakeAnswerValue(hasIncomeQuestion!.field, "Yes"),
    )
    questions = buildIntakeQuestions(data)
    const otherIncomeQuestion = questions.find((question) => question.id.endsWith(":other_income:selected"))
    expect(otherIncomeQuestion).toBeDefined()

    data = writeIntakeQuestionValue(
      data,
      otherIncomeQuestion!,
      parseIntakeAnswerValue(otherIncomeQuestion!.field, "Unemployment"),
    )
    questions = buildIntakeQuestions(data)

    expect(questions.map((question) => question.id)).toEqual(
      expect.arrayContaining([
        "complex:person:0:income:other_income:inc_unemployment:amount",
        "complex:person:0:income:other_income:inc_unemployment:frequency",
      ]),
    )
  })

  it("asks yearly amount for selected deductions", () => {
    let data = createInitialIntakeData()
    let questions = buildIntakeQuestions(data)
    const hasIncomeQuestion = questions.find((question) => question.field.id === "has_income")
    expect(hasIncomeQuestion).toBeDefined()

    data = writeIntakeQuestionValue(
      data,
      hasIncomeQuestion!,
      parseIntakeAnswerValue(hasIncomeQuestion!.field, "Yes"),
    )
    questions = buildIntakeQuestions(data)
    const deductionsQuestion = questions.find((question) => question.id.endsWith(":deductions:selected"))
    expect(deductionsQuestion).toBeDefined()

    data = writeIntakeQuestionValue(
      data,
      deductionsQuestion!,
      parseIntakeAnswerValue(deductionsQuestion!.field, "Student loan interest deduction (interest only, not total payment)"),
    )
    questions = buildIntakeQuestions(data)

    expect(questions.map((question) => question.id)).toContain(
      "complex:person:0:income:deductions:ded_student_loan:yearly_amount",
    )
  })

  it("marks complex questions answered once their values are collected", () => {
    let data = createInitialIntakeData()
    let questions = buildIntakeQuestions(data)
    const hasIncomeQuestion = questions.find((question) => question.field.id === "has_income")
    expect(hasIncomeQuestion).toBeDefined()
    data = writeIntakeQuestionValue(data, hasIncomeQuestion!, "Yes")

    questions = buildIntakeQuestions(data)
    const employmentCountQuestion = questions.find((question) => question.id.endsWith(":employment_jobs:count"))
    expect(employmentCountQuestion).toBeDefined()
    data = writeIntakeQuestionValue(data, employmentCountQuestion!, "0")

    questions = buildIntakeQuestions(data)
    const answered = computeAnsweredIntakeQuestionIds(questions, data)
    expect(answered.has(employmentCountQuestion!.id)).toBe(true)
  })

  it("maps chat progress to the wizard step for the next pending question", () => {
    const data = createInitialIntakeData()
    const questions = buildIntakeQuestions(data)
    const answered = computeAnsweredIntakeQuestionIds(questions, data)

    expect(questions.find((question) => question.field.id === "p1_name")?.id).toBeDefined()
    expect(getWizardStepForIntakeProgress(questions, answered, data, new Set())).toBe(2)
  })
})
