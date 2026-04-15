/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for POST /api/agents/appeal.
 *
 * Strategy: mock every external dependency (auth, LLM, tools, logger) so tests
 * run without Ollama or a real DB. The AI SDK streaming helpers are stubbed to
 * call execute() synchronously and return a sentinel 200 Response.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock declarations (hoisted before imports) ────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
  logServerInfo: vi.fn(),
}))

vi.mock("@/lib/masshealth/ollama-provider", () => ({
  getOllamaModel: vi.fn().mockReturnValue("mock-model"),
}))

vi.mock("@/lib/agents/appeal/tools", () => ({
  buildAppealTools: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/agents/appeal/prompts", () => ({
  buildAppealAgentSystemPrompt: vi.fn().mockReturnValue("appeal-system-prompt"),
}))

vi.mock("ai", () => {
  const fakeWriter = { write: vi.fn(), merge: vi.fn() }
  const fakeStream = Symbol("fakeStream")
  return {
    createUIMessageStream: vi.fn(({ execute }: { execute: (ctx: { writer: typeof fakeWriter }) => void }) => {
      execute({ writer: fakeWriter })
      return fakeStream
    }),
    createUIMessageStreamResponse: vi.fn(() => new Response('{"ok":true}', { status: 200 })),
    streamText: vi.fn().mockReturnValue({ toUIMessageStream: vi.fn().mockReturnValue(Symbol("textStream")) }),
    stepCountIs: vi.fn().mockReturnValue(() => false),
  }
})

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { POST } from "@/app/api/agents/appeal/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { createUIMessageStreamResponse, streamText } from "ai"
import { buildAppealAgentSystemPrompt } from "@/lib/agents/appeal/prompts"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

const VALID_BODY = {
  denialReasonId: "income_exceeds_limit",
  denialDetails: "I earn $2,800/month but MassHealth calculated $3,200.",
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/agents/appeal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
})

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("POST /api/agents/appeal — auth", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)

    const response = await POST(makeRequest(VALID_BODY))
    expect(response.status).toBe(401)
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe("POST /api/agents/appeal — validation", () => {
  it("returns 400 when denialReasonId is missing", async () => {
    const response = await POST(makeRequest({ denialDetails: "some details" }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when denialReasonId is not a known value", async () => {
    const response = await POST(makeRequest({ denialReasonId: "unknown_reason" }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when denialDetails exceeds max length", async () => {
    const response = await POST(makeRequest({ denialReasonId: "income_exceeds_limit", denialDetails: "x".repeat(1001) }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when documentText exceeds 8000 characters", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, documentText: "x".repeat(8001) }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/agents/appeal — happy path", () => {
  it("returns 200 for a valid request", async () => {
    const response = await POST(makeRequest(VALID_BODY))
    expect(response.status).toBe(200)
  })

  it("delegates to createUIMessageStreamResponse", async () => {
    await POST(makeRequest(VALID_BODY))
    expect(createUIMessageStreamResponse).toHaveBeenCalledOnce()
  })

  it("passes the denial reason object to the prompt builder", async () => {
    await POST(makeRequest(VALID_BODY))
    expect(buildAppealAgentSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ id: "income_exceeds_limit" }),
      "en",
    )
  })

  it("composes a user message that includes the denial label", async () => {
    await POST(makeRequest(VALID_BODY))
    const calls = vi.mocked(streamText).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const { messages } = calls[0][0] as { messages: { role: string; content: string }[] }
    expect(messages[0].content).toContain("Income exceeds eligibility limit")
  })

  it("includes denialDetails in the composed user message when provided", async () => {
    await POST(makeRequest(VALID_BODY))
    const calls = vi.mocked(streamText).mock.calls
    const { messages } = calls[0][0] as { messages: { role: string; content: string }[] }
    expect(messages[0].content).toContain("$2,800/month")
  })

  it("includes documentText in the composed user message when provided", async () => {
    await POST(makeRequest({ ...VALID_BODY, documentText: "Your application was denied on March 1." }))
    const calls = vi.mocked(streamText).mock.calls
    const { messages } = calls[0][0] as { messages: { role: string; content: string }[] }
    expect(messages[0].content).toContain("Your application was denied on March 1.")
  })

  it("defaults to 'en' when no language is provided", async () => {
    await POST(makeRequest(VALID_BODY))
    expect(buildAppealAgentSystemPrompt).toHaveBeenCalledWith(expect.anything(), "en")
  })

  it("uses the provided language when it is a supported locale", async () => {
    await POST(makeRequest({ ...VALID_BODY, language: "ht" }))
    expect(buildAppealAgentSystemPrompt).toHaveBeenCalledWith(expect.anything(), "ht")
  })

  it("accepts all valid denial reason IDs without a 400", async () => {
    const ids = [
      "missing_disability_proof",
      "income_exceeds_limit",
      "residency_not_verified",
      "citizenship_immigration",
      "age_not_eligible",
      "already_enrolled",
      "missing_documentation",
      "ssn_not_verified",
      "other",
    ]
    for (const id of ids) {
      const response = await POST(makeRequest({ denialReasonId: id }))
      expect(response.status).toBe(200)
    }
  })
})
