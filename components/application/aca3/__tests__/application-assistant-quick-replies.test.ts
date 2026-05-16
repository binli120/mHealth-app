/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import React from "react"
import { configureStore } from "@reduxjs/toolkit"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Provider } from "react-redux"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ASSISTANT_CONNECTION_FAILURE_MESSAGE,
  ApplicationAssistant,
  getImmediateFieldPatchFromAnswer,
  getNextMissingApplicationQuestion,
  getQuickRepliesForAssistantPrompt,
  hasDocumentUploadPrompt,
  hasPersistableAssistantDraft,
  recoverImmediateFieldsFromMessages,
  sanitizeAssistantDraftMessages,
} from "@/components/application/aca3/application-assistant"
import { appReducer } from "@/lib/redux/features/app-slice"
import { initialApplicationFormData } from "@/lib/redux/features/application-slice"
import { applicationReducer } from "@/lib/redux/features/application-slice"
import { userProfileReducer } from "@/lib/redux/features/user-profile-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))

interface ApplicationAssistantTestProps {
  applicationId?: string
  actingForPatientId?: string
  onSwitchToWizard?: () => void
}

function makeStore() {
  return configureStore({
    reducer: {
      app: appReducer,
      application: applicationReducer,
      userProfile: userProfileReducer,
    },
  })
}

function renderApplicationAssistant(props: ApplicationAssistantTestProps = {}) {
  const TestComponent = ApplicationAssistant as React.ComponentType<ApplicationAssistantTestProps>
  return render(
    React.createElement(
      Provider,
      { store: makeStore() },
      React.createElement(TestComponent, props),
    ),
  )
}

function getChatCalls() {
  return vi
    .mocked(authenticatedFetch)
    .mock.calls
    .filter(([input]) => input === "/api/chat/masshealth")
}

function submitAssistantInput(value: string) {
  const textbox = screen.getByPlaceholderText(/type your answer/i)
  fireEvent.change(textbox, { target: { value } })
  fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" })
}

function makeChatStreamResponse(annotation: Record<string, unknown>, text: string): Response {
  const chunks = [
    `data: ${JSON.stringify({ type: "data-masshealth", data: annotation })}\n\n`,
    `data: ${JSON.stringify({ type: "text-delta", id: "0", delta: text })}\n\n`,
  ]
  return new Response(chunks.join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
    if (typeof input === "string" && input.includes("/draft")) {
      return new Response(JSON.stringify({ ok: false }), { status: 404 })
    }
    return makeChatStreamResponse({ ok: true }, "Okay.")
  })
})

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

describe("ApplicationAssistant chat request contract", () => {
  it("builds the form-assistant prompt context from immediate client-side patches", async () => {
    renderApplicationAssistant()

    await screen.findByText(/what's your first name/i)
    submitAssistantInput("John")

    await waitFor(() => expect(getChatCalls()).toHaveLength(1))
    const init = getChatCalls()[0]?.[1] as RequestInit
    const body = JSON.parse(String(init.body)) as { currentFields?: string }

    expect(body.currentFields).toContain("First name: [provided]")
  })

  it("keeps SSN-like input out of the model request", async () => {
    renderApplicationAssistant()

    await screen.findByText(/what's your first name/i)
    submitAssistantInput("123-45-6789")

    await screen.findByText(/please enter your ssn directly in the form/i)
    expect(getChatCalls()).toHaveLength(0)
  })

  it("includes the acting-for patient header when loading a social-worker draft", async () => {
    const applicationId = "11111111-1111-4111-8111-111111111111"
    const actingForPatientId = "22222222-2222-4222-8222-222222222222"

    renderApplicationAssistant({ applicationId, actingForPatientId })

    await waitFor(() => {
      expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledWith(
        `/api/applications/${applicationId}/draft`,
        expect.objectContaining({ method: "GET" }),
      )
    })

    const draftCall = vi
      .mocked(authenticatedFetch)
      .mock.calls
      .find(([input]) => input === `/api/applications/${applicationId}/draft`)
    const init = draftCall?.[1] as RequestInit

    expect(init.headers).toMatchObject({
      "X-Acting-For-Patient": actingForPatientId,
    })
  })

  it("validates newly extracted address fields before comparing against patched state", async () => {
    vi.mocked(authenticatedFetch).mockImplementation(async (input) => {
      if (typeof input === "string" && input.includes("/draft")) {
        return new Response(JSON.stringify({ ok: false }), { status: 404 })
      }
      if (input === "/api/chat/masshealth") {
        return makeChatStreamResponse(
          {
            ok: true,
            extractedFields: {
              address: "1 Main St",
              city: "Boston",
              state: "MA",
              zip: "02108",
            },
          },
          "Thanks, I saved that address.",
        )
      }
      if (input === "/api/address/validate") {
        return new Response(
          JSON.stringify({
            ok: true,
            valid: true,
            message: "valid",
            suggestion: {
              streetAddress: "1 Main St",
              city: "Boston",
              state: "MA",
              zipCode: "02108",
              county: "Suffolk",
              displayName: "1 Main St, Boston, MA 02108",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      return new Response("", { status: 200 })
    })

    renderApplicationAssistant()

    await screen.findByText(/what's your first name/i)
    submitAssistantInput("John")

    await waitFor(() => {
      expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledWith(
        "/api/address/validate",
        expect.objectContaining({ method: "POST" }),
      )
    })
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
