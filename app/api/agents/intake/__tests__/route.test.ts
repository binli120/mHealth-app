/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for POST /api/agents/intake.
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

vi.mock("@/lib/agents/intake/tools", () => ({
  buildIntakeTools: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/agents/intake/prompts", () => ({
  buildIntakeAgentSystemPrompt: vi.fn().mockReturnValue("intake-system-prompt"),
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

import { POST } from "@/app/api/agents/intake/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { createUIMessageStreamResponse } from "ai"
import { buildIntakeTools } from "@/lib/agents/intake/tools"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const ONE_USER_MESSAGE = [{ role: "user", content: "I want to apply for MassHealth" }]
const CONVERSATION = [
  { role: "assistant", content: "What is your name?" },
  { role: "user", content: "My name is David Chen" },
]

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/agents/intake", {
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

describe("POST /api/agents/intake — auth", () => {
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

describe("POST /api/agents/intake — validation", () => {
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

  it("returns 400 when applicationType exceeds 64 characters", async () => {
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE, applicationType: "x".repeat(65) }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/agents/intake — happy path", () => {
  it("returns 200 for a valid request", async () => {
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(response.status).toBe(200)
  })

  it("delegates to createUIMessageStreamResponse", async () => {
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(createUIMessageStreamResponse).toHaveBeenCalledOnce()
  })

  it("passes the last user message to buildIntakeTools", async () => {
    await POST(makeRequest({ messages: CONVERSATION }))
    expect(buildIntakeTools).toHaveBeenCalledWith("My name is David Chen")
  })

  it("passes an empty string to buildIntakeTools when there is no user message", async () => {
    const assistantOnly = [{ role: "assistant", content: "Welcome! What is your name?" }]
    await POST(makeRequest({ messages: assistantOnly }))
    expect(buildIntakeTools).toHaveBeenCalledWith("")
  })

  it("defaults to 'en' when no language is provided", async () => {
    const { buildIntakeAgentSystemPrompt } = await import("@/lib/agents/intake/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(buildIntakeAgentSystemPrompt).toHaveBeenCalledWith("en", undefined)
  })

  it("passes applicationType to the prompt builder when provided", async () => {
    const { buildIntakeAgentSystemPrompt } = await import("@/lib/agents/intake/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE, applicationType: "ACA-3" }))
    expect(buildIntakeAgentSystemPrompt).toHaveBeenCalledWith("en", "ACA-3")
  })

  it("uses the provided language when it is a supported locale", async () => {
    const { buildIntakeAgentSystemPrompt } = await import("@/lib/agents/intake/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE, language: "pt-BR" }))
    expect(buildIntakeAgentSystemPrompt).toHaveBeenCalledWith("pt-BR", undefined)
  })
})
