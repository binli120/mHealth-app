/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for POST /api/chat/masshealth.
 *
 * Strategy: mock every external dependency so tests run without Ollama, a
 * database, or a real auth session. The AI SDK streaming helpers are stubbed
 * to return a minimal streaming-shaped Response so we can assert on routing
 * logic and validation without wiring up real SSE.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock declarations (hoisted before imports) ────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/db/admin-analytics", () => ({
  logChatRequest: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
}))

vi.mock("@/lib/masshealth/ollama-provider", () => ({
  getOllamaModel: vi.fn().mockReturnValue("mock-model"),
}))

vi.mock("@/lib/masshealth/fact-extraction", () => ({
  extractEligibilityFacts: vi.fn().mockResolvedValue({}),
  applyFactDefaults: vi.fn().mockReturnValue({}),
  isSufficientForEvaluation: vi.fn().mockReturnValue(false),
}))

vi.mock("@/lib/masshealth/form-field-extraction", () => ({
  extractFormFields: vi.fn().mockResolvedValue({
    fields: {},
    noHouseholdMembers: false,
    noIncome: false,
    extractionFailed: false,
  }),
}))

vi.mock("@/lib/masshealth/chat-knowledge", () => ({
  buildBenefitAdvisorSystemPrompt: vi.fn().mockReturnValue("benefit-advisor-prompt"),
  buildFormAssistantSystemPrompt: vi.fn().mockReturnValue("form-assistant-prompt"),
  buildMassHealthIntakeSystemPrompt: vi.fn().mockReturnValue("intake-prompt"),
  buildMassHealthSystemPrompt: vi.fn().mockReturnValue("assistant-prompt"),
  buildMassHealthSystemPromptWithContext: vi.fn().mockReturnValue("assistant-with-context-prompt"),
  getMassHealthOutOfScopeResponse: vi.fn().mockReturnValue("I can only help with MassHealth topics."),
  isMassHealthTopic: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/eligibility-engine", () => ({
  runEligibilityCheck: vi.fn().mockReturnValue({ fplPercent: 100, annualFPL: 15000, summary: "", results: [] }),
}))

vi.mock("@/lib/rag/retrieve", () => ({
  retrieveRelevantChunks: vi.fn().mockResolvedValue([]),
  formatChunksForPrompt: vi.fn().mockReturnValue(""),
}))

vi.mock("@/lib/masshealth/household-relationships", () => ({
  extractHouseholdRelationshipHints: vi.fn().mockReturnValue([]),
}))

// Stub AI SDK streaming so tests don't need a real LLM.
// createUIMessageStreamResponse returns a sentinel Response.
// createUIMessageStream calls execute() synchronously and returns a fake stream.
vi.mock("ai", () => {
  const fakeWriter = {
    write: vi.fn(),
    merge: vi.fn(),
  }
  const fakeStream = Symbol("fakeStream")
  return {
    createUIMessageStream: vi.fn(({ execute }: { execute: (ctx: { writer: typeof fakeWriter }) => void }) => {
      execute({ writer: fakeWriter })
      return fakeStream
    }),
    createUIMessageStreamResponse: vi.fn(() => new Response('{"ok":true}', { status: 200 })),
    streamText: vi.fn().mockReturnValue({ toUIMessageStream: vi.fn().mockReturnValue(Symbol("textStream")) }),
  }
})

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { POST } from "@/app/api/chat/masshealth/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { isMassHealthTopic } from "@/lib/masshealth/chat-knowledge"
import { isSufficientForEvaluation } from "@/lib/masshealth/fact-extraction"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const ONE_USER_MESSAGE = [{ role: "user", content: "Am I eligible for MassHealth?" }]

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/chat/masshealth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  vi.mocked(isMassHealthTopic).mockReturnValue(true)
  vi.mocked(isSufficientForEvaluation).mockReturnValue(false)
})

// ── Auth & top-level validation ───────────────────────────────────────────────

describe("POST /api/chat/masshealth — auth", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)

    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE }))

    expect(response.status).toBe(401)
  })
})

describe("POST /api/chat/masshealth — validation", () => {
  it("returns 400 when messages is missing", async () => {
    const response = await POST(makeRequest({}))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when messages array is empty", async () => {
    const response = await POST(makeRequest({ messages: [] }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when a message content exceeds max length", async () => {
    const longContent = "x".repeat(6001)
    const response = await POST(makeRequest({ messages: [{ role: "user", content: longContent }] }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when message has an invalid role", async () => {
    const response = await POST(makeRequest({ messages: [{ role: "system", content: "hello" }] }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when mode is unrecognised", async () => {
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE, mode: "unknown_mode" }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when there is no user message in the array (only assistant)", async () => {
    // A conversation with only an assistant message has no lastUserMessage.
    const response = await POST(
      makeRequest({ messages: [{ role: "assistant", content: "Hello, how can I help?" }] }),
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/user message/i)
  })
})

// ── Mode routing ──────────────────────────────────────────────────────────────

describe("POST /api/chat/masshealth — mode routing", () => {
  it("routes to benefit_advisor handler and returns a streaming response", async () => {
    const response = await POST(
      makeRequest({ messages: ONE_USER_MESSAGE, mode: "benefit_advisor" }),
    )

    expect(response.status).toBe(200)
    expect(createUIMessageStreamResponse).toHaveBeenCalledTimes(1)
  })

  it("routes to form_assistant handler and returns a streaming response", async () => {
    const response = await POST(
      makeRequest({
        messages: ONE_USER_MESSAGE,
        mode: "form_assistant",
        currentSection: "personal",
      }),
    )

    expect(response.status).toBe(200)
    expect(createUIMessageStreamResponse).toHaveBeenCalledTimes(1)
  })

  it("routes to application_intake handler and returns a streaming response", async () => {
    const response = await POST(
      makeRequest({ messages: ONE_USER_MESSAGE, mode: "application_intake" }),
    )

    expect(response.status).toBe(200)
    expect(createUIMessageStreamResponse).toHaveBeenCalledTimes(1)
  })

  it("routes to assistant (default) handler when no mode is provided", async () => {
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE }))

    expect(response.status).toBe(200)
    expect(createUIMessageStreamResponse).toHaveBeenCalledTimes(1)
  })

  it("returns out-of-scope data stream without calling streamText", async () => {
    const { streamText } = await import("ai")
    vi.mocked(isMassHealthTopic).mockReturnValue(false)

    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE }))

    expect(response.status).toBe(200)
    // Out-of-scope path still uses createUIMessageStream but must NOT call streamText
    expect(createUIMessageStream).toHaveBeenCalledTimes(1)
    expect(streamText).not.toHaveBeenCalled()
  })
})

// ── benefit_advisor — eligibility branch ──────────────────────────────────────

describe("POST /api/chat/masshealth — benefit_advisor eligibility", () => {
  it("calls runEligibilityCheck when facts are sufficient", async () => {
    const { runEligibilityCheck } = await import("@/lib/eligibility-engine")
    vi.mocked(isSufficientForEvaluation).mockReturnValue(true)

    await POST(makeRequest({ messages: ONE_USER_MESSAGE, mode: "benefit_advisor" }))

    expect(runEligibilityCheck).toHaveBeenCalledTimes(1)
  })

  it("skips runEligibilityCheck when facts are insufficient", async () => {
    const { runEligibilityCheck } = await import("@/lib/eligibility-engine")
    vi.mocked(isSufficientForEvaluation).mockReturnValue(false)

    await POST(makeRequest({ messages: ONE_USER_MESSAGE, mode: "benefit_advisor" }))

    expect(runEligibilityCheck).not.toHaveBeenCalled()
  })
})

// ── Language handling ─────────────────────────────────────────────────────────

describe("POST /api/chat/masshealth — language", () => {
  it("accepts a valid supported language parameter", async () => {
    const { buildMassHealthSystemPrompt } = await import("@/lib/masshealth/chat-knowledge")

    await POST(makeRequest({ messages: ONE_USER_MESSAGE, language: "es" }))

    // The language is forwarded to the prompt builder; verify it was called
    expect(buildMassHealthSystemPrompt).toHaveBeenCalledWith("es")
  })

  it("falls back to 'en' for an unsupported language", async () => {
    const { buildMassHealthSystemPrompt } = await import("@/lib/masshealth/chat-knowledge")

    await POST(makeRequest({ messages: ONE_USER_MESSAGE, language: "xx" }))

    expect(buildMassHealthSystemPrompt).toHaveBeenCalledWith("en")
  })
})
