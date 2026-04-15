/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for POST /api/agents/benefit-advisor.
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

vi.mock("@/lib/agents/benefit-advisor/tools", () => ({
  buildBenefitAdvisorTools: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/agents/benefit-advisor/prompts", () => ({
  buildBenefitAdvisorAgentSystemPrompt: vi.fn().mockReturnValue("benefit-advisor-system-prompt"),
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

import { POST } from "@/app/api/agents/benefit-advisor/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { createUIMessageStreamResponse } from "ai"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ONE_USER_MESSAGE = [{ role: "user", content: "Am I eligible for MassHealth?" }]

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/agents/benefit-advisor", {
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

describe("POST /api/agents/benefit-advisor — auth", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)

    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(response.status).toBe(401)
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe("POST /api/agents/benefit-advisor — validation", () => {
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

  it("returns 400 when a message content exceeds 6000 characters", async () => {
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

  it("returns 400 when more than 30 messages are sent", async () => {
    const messages = Array.from({ length: 31 }, () => ({ role: "user", content: "hi" }))
    const response = await POST(makeRequest({ messages }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/agents/benefit-advisor — happy path", () => {
  it("returns 200 for a valid request", async () => {
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(response.status).toBe(200)
  })

  it("delegates to createUIMessageStreamResponse", async () => {
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(createUIMessageStreamResponse).toHaveBeenCalledOnce()
  })

  it("defaults to 'en' when no language is provided", async () => {
    const { buildBenefitAdvisorAgentSystemPrompt } = await import("@/lib/agents/benefit-advisor/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(buildBenefitAdvisorAgentSystemPrompt).toHaveBeenCalledWith("en")
  })

  it("uses the provided language when it is a supported locale", async () => {
    const { buildBenefitAdvisorAgentSystemPrompt } = await import("@/lib/agents/benefit-advisor/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE, language: "es" }))
    expect(buildBenefitAdvisorAgentSystemPrompt).toHaveBeenCalledWith("es")
  })

  it("falls back to 'en' for an unsupported language code", async () => {
    const { buildBenefitAdvisorAgentSystemPrompt } = await import("@/lib/agents/benefit-advisor/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE, language: "klingon" }))
    expect(buildBenefitAdvisorAgentSystemPrompt).toHaveBeenCalledWith("en")
  })
})
