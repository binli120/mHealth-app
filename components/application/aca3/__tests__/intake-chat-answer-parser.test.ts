/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"

import {
  extractFinalQuestionSentence,
  formatQuestionPrompt,
  parseAnswerValue,
  toSpeakableQuestionText,
} from "@/components/application/aca3/intake-chat-answer-parser"
import type { IntakeQuestion } from "@/components/application/aca3/intake-chat-types"
import type { SchemaField } from "@/components/application/aca3/types"

function question(field: SchemaField): IntakeQuestion {
  return {
    id: `person:0:coverage:${field.id}`,
    field,
    scope: "person",
    sectionKey: "coverage",
    personIndex: 0,
  }
}

describe("intake chat answer parser", () => {
  it("formats supplemental immigration status options for plain-text schema fields", () => {
    const prompt = formatQuestionPrompt(
      question({
        id: "immigration_status_type",
        label: "Immigration status",
        type: "text",
      }),
    )

    expect(prompt).toContain("1. Lawful Permanent Resident")
    expect(prompt).toContain("Choose one or more")
  })

  it("parses numbered supplemental immigration status selections", () => {
    expect(
      parseAnswerValue(
        {
          id: "immigration_status_type",
          label: "Immigration status",
          type: "text",
        },
        "1, 3",
      ),
    ).toBe("Lawful Permanent Resident (Green Card holder), Asylee")
  })

  it("parses numbered supplemental immigration document type selections", () => {
    expect(
      parseAnswerValue(
        {
          id: "immigration_doc_type",
          label: "Immigration document type",
          type: "text",
        },
        "4",
      ),
    ).toBe("Arrival/Departure Record (I-94)")
  })

  it("adds date format guidance to date prompts", () => {
    expect(
      formatQuestionPrompt(
        question({
          id: "immigration_doc_expiry",
          label: "Passport or document expiration date (mm/dd/yyyy)",
          type: "date",
        }),
      ),
    ).toContain("Use MM/DD/YYYY")
  })

  it("speaks only the final question sentence, never the leading context", () => {
    expect(
      toSpeakableQuestionText("Here is some context you already gave me. What is your date of birth?"),
    ).toBe("What is your date of birth?")
  })

  it("keeps the trailing prompt for option questions instead of reading the whole message", () => {
    expect(
      extractFinalQuestionSentence(
        "Person 1: What coverage do you have? Options: Medicare, MassHealth, None. What is your answer?",
      ),
    ).toBe("What is your answer?")
  })

  it("falls back to the last sentence when there is no question mark", () => {
    expect(extractFinalQuestionSentence("Use MM/DD/YYYY, or choose a date.")).toBe(
      "Use MM/DD/YYYY, or choose a date.",
    )
  })

  it("returns a lone question unchanged", () => {
    expect(extractFinalQuestionSentence("Are you a Massachusetts resident?")).toBe(
      "Are you a Massachusetts resident?",
    )
  })

  it("treats none as an empty optional checkbox-group answer", () => {
    expect(
      parseAnswerValue(
        {
          id: "trafficking_victim",
          label: "Trafficking victim",
          type: "checkbox_group",
          options: [
            "Victim of severe trafficking",
            "Spouse, child, sibling, or parent of a trafficking victim",
          ],
        },
        "None",
      ),
    ).toEqual([])
  })
})
