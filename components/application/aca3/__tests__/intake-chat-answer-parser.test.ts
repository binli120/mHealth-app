/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import {
  formatQuestionPrompt,
  parseAnswerValue,
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
