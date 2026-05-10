/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import {
  ASSISTANT_CONNECTION_FAILURE_MESSAGE,
  getImmediateFieldPatchFromAnswer,
  getNextMissingApplicationQuestion,
  getQuickRepliesForAssistantPrompt,
  hasDocumentUploadPrompt,
  hasPersistableAssistantDraft,
  recoverImmediateFieldsFromMessages,
  sanitizeAssistantDraftMessages,
} from "@/components/application/aca3/application-assistant"
import { initialApplicationFormData } from "@/lib/redux/features/application-slice"

describe("getQuickRepliesForAssistantPrompt", () => {
  it("returns explicit profile pre-fill quick replies while pending", () => {
    expect(getQuickRepliesForAssistantPrompt("Any prompt", "pending")).toEqual([
      { label: "Yes, use my saved info", value: "Yes" },
      { label: "No, start fresh", value: "No" },
    ])
  })

  it("returns generic yes/no replies for confirmation prompts", () => {
    expect(getQuickRepliesForAssistantPrompt("Did you mean 100 Main Street, Boston, MA?", "declined")).toEqual([
      { label: "Yes", value: "Yes" },
      { label: "No", value: "No" },
    ])
  })

  it("keeps saved-info quick replies when the visible prompt has yes/no copy", () => {
    expect(getQuickRepliesForAssistantPrompt(
      "Reply **Yes** to use your saved info, or **No** to start fresh.",
      "declined",
    )).toEqual([
      { label: "Yes, use my saved info", value: "Yes" },
      { label: "No, start fresh", value: "No" },
    ])
  })

  it("does not return replies for open-ended prompts", () => {
    expect(getQuickRepliesForAssistantPrompt("What's your first name?", "declined")).toEqual([])
  })
})

describe("getNextMissingApplicationQuestion", () => {
  it("asks for the first missing personal field", () => {
    expect(getNextMissingApplicationQuestion({ firstName: "John" })).toBe("What is your last name?")
  })

  it("asks for the first missing contact field after profile pre-fill", () => {
    expect(getNextMissingApplicationQuestion({
      firstName: "John",
      lastName: "Patient",
      dob: "01/01/1980",
      phone: "(617) 555-0100",
      address: "100 Main St",
      city: "Boston",
      state: "MA",
      zip: "02108",
    })).toBe("What is your email address?")
  })

  it("moves to household after personal and contact are complete", () => {
    expect(getNextMissingApplicationQuestion({
      firstName: "John",
      lastName: "Patient",
      dob: "01/01/1980",
      email: "john@example.com",
      phone: "(617) 555-0100",
      address: "100 Main St",
      city: "Boston",
      zip: "02108",
    })).toBe("Does anyone else live in your household?")
  })
})

describe("getImmediateFieldPatchFromAnswer", () => {
  it("patches the first name immediately from the active prompt", () => {
    expect(getImmediateFieldPatchFromAnswer(
      "John",
      "Let's start with your name. What's your first name?",
      initialApplicationFormData,
      "personal",
      "text",
    ).fields).toMatchObject({ firstName: "John" })
  })

  it("parses a pasted full address into contact fields before the AI response", () => {
    expect(getImmediateFieldPatchFromAnswer(
      "290 Congress St, Boston, MA 02210",
      "What is your home street address?",
      initialApplicationFormData,
      "contact",
      "text",
    ).fields).toMatchObject({
      address: "290 Congress St",
      city: "Boston",
      state: "MA",
      zip: "02210",
    })
  })

  it("marks household as complete when the user says they live alone", () => {
    const result = getImmediateFieldPatchFromAnswer(
      "I live alone",
      "Does anyone else live in your household?",
      initialApplicationFormData,
      "household",
      "text",
    )

    expect(result.noHouseholdMembers).toBe(true)
  })
})

describe("recoverImmediateFieldsFromMessages", () => {
  it("backfills progress fields from an existing Compass transcript", () => {
    const recovered = recoverImmediateFieldsFromMessages([
      { id: "a1", type: "text", role: "assistant", content: "What's your first name?" },
      { id: "u1", type: "text", role: "user", content: "John" },
      { id: "a2", type: "text", role: "assistant", content: "What is your last name?" },
      { id: "u2", type: "text", role: "user", content: "Patient" },
      { id: "a3", type: "text", role: "assistant", content: "What is your date of birth?" },
      { id: "u3", type: "text", role: "user", content: "Jan 17, 1980" },
      { id: "a4", type: "text", role: "assistant", content: "What is your home street address?" },
      { id: "u4", type: "text", role: "user", content: "290 Congress St, Boston, MA 02210" },
    ], initialApplicationFormData)

    expect(recovered.fields).toMatchObject({
      firstName: "John",
      lastName: "Patient",
      dob: "01/17/1980",
      address: "290 Congress St",
      city: "Boston",
      state: "MA",
      zip: "02210",
    })
  })
})

describe("sanitizeAssistantDraftMessages", () => {
  it("keeps only one document upload prompt when a resumed draft already has duplicates", () => {
    const messages = sanitizeAssistantDraftMessages([
      { id: "a1", type: "text", role: "assistant", content: "Question one" },
      {
        id: "d1",
        type: "upload_prompt",
        role: "assistant",
        content: "Now let's upload a few supporting documents to complete your application.",
        docTypes: [{ type: "identity", label: "Government-Issued ID", description: "ID" }],
      },
      { id: "u1", type: "text", role: "user", content: "I came back later" },
      {
        id: "d2",
        type: "upload_prompt",
        role: "assistant",
        content: "Now let's upload a few supporting documents to complete your application.",
        docTypes: [{ type: "proof_of_income", label: "Proof of Income", description: "Pay stub" }],
      },
    ])

    const uploadPrompts = messages.filter((message) => message.type === "upload_prompt")

    expect(uploadPrompts).toHaveLength(1)
    expect(uploadPrompts[0].id).toBe("d2")
    expect(hasDocumentUploadPrompt(messages)).toBe(true)
  })
})

describe("hasPersistableAssistantDraft", () => {
  it("does not persist a greeting-only assistant transcript", () => {
    expect(hasPersistableAssistantDraft(
      {},
      [{ id: "a1", type: "text", role: "assistant", content: "Let's start your application." }],
      false,
      false,
    )).toBe(false)
  })

  it("persists once the applicant has answered a question", () => {
    expect(hasPersistableAssistantDraft(
      {},
      [
        { id: "a1", type: "text", role: "assistant", content: "What is your first name?" },
        { id: "u1", type: "text", role: "user", content: "Maria" },
      ],
      false,
      false,
    )).toBe(true)
  })

  it("persists prefilled fields and section-completion flags", () => {
    expect(hasPersistableAssistantDraft({ firstName: "Maria" }, [], false, false)).toBe(true)
    expect(hasPersistableAssistantDraft({}, [], true, false)).toBe(true)
    expect(hasPersistableAssistantDraft({}, [], false, true)).toBe(true)
  })
})

describe("ASSISTANT_CONNECTION_FAILURE_MESSAGE", () => {
  it("points users to the Form Wizard when the AI engine is unavailable", () => {
    expect(ASSISTANT_CONNECTION_FAILURE_MESSAGE).toContain("AI engine")
    expect(ASSISTANT_CONNECTION_FAILURE_MESSAGE).toContain("Form Wizard")
  })
})
