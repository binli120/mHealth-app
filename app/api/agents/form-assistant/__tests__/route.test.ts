/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for POST /api/agents/form-assistant.
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

vi.mock("@/lib/agents/form-assistant/tools", () => ({
  buildFormAssistantTools: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/agents/form-assistant/prompts", () => ({
  buildFormAssistantAgentSystemPrompt: vi.fn().mockReturnValue("form-assistant-system-prompt"),
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

import { POST } from "@/app/api/agents/form-assistant/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { createUIMessageStreamResponse } from "ai"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const ONE_USER_MESSAGE = [{ role: "user", content: "My name is Maria Rossi" }]

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/agents/form-assistant", {
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

describe("POST /api/agents/form-assistant — auth", () => {
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

describe("POST /api/agents/form-assistant — validation", () => {
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

  it("returns 400 when currentSection is not a valid section name", async () => {
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE, currentSection: "medical_history" }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })

  it("returns 400 when existingMembers exceeds the 20-item limit", async () => {
    const members = Array.from({ length: 21 }, (_, i) => ({ id: `m${i}` }))
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE, existingMembers: members }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })
})

// ── SSN scrubbing — PHI must never reach the LLM ─────────────────────────────

describe("POST /api/agents/form-assistant — SSN scrubbing", () => {
  it("strips ssn from existingMembers before passing them to buildFormAssistantTools", async () => {
    const { buildFormAssistantTools } = await import("@/lib/agents/form-assistant/tools")

    await POST(
      makeRequest({
        messages: ONE_USER_MESSAGE,
        existingMembers: [
          {
            id: "m1",
            firstName: "Alice",
            lastName: "Smith",
            relationship: "spouse",
            dob: "1985-05-15",
            ssn: "123-45-6789",
            pregnant: false,
            disabled: false,
            over65: false,
          },
        ],
      }),
    )

    expect(buildFormAssistantTools).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(buildFormAssistantTools).mock.calls[0]?.[0]
    const members = callArgs?.existingMembers ?? []
    expect(members).toHaveLength(1)
    // SSN must be zeroed out — never forwarded to the model
    expect(members[0]).toMatchObject({ id: "m1", firstName: "Alice", ssn: "" })
    expect(members[0]?.ssn).toBe("")
  })

  it("handles multiple members and zeros all SSNs", async () => {
    const { buildFormAssistantTools } = await import("@/lib/agents/form-assistant/tools")

    await POST(
      makeRequest({
        messages: ONE_USER_MESSAGE,
        existingMembers: [
          { id: "m1", firstName: "Alice", ssn: "111-22-3333" },
          { id: "m2", firstName: "Bob", ssn: "444556666" },
        ],
      }),
    )

    const callArgs = vi.mocked(buildFormAssistantTools).mock.calls[0]?.[0]
    const members = callArgs?.existingMembers ?? []
    expect(members.every((m: { ssn: string }) => m.ssn === "")).toBe(true)
  })

  it("works correctly when existingMembers is empty", async () => {
    const response = await POST(
      makeRequest({ messages: ONE_USER_MESSAGE, existingMembers: [] }),
    )
    expect(response.status).toBe(200)
  })

  it("works correctly when existingMembers is omitted", async () => {
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(response.status).toBe(200)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/agents/form-assistant — happy path", () => {
  it("returns 200 for a valid request", async () => {
    const response = await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(response.status).toBe(200)
  })

  it("delegates to createUIMessageStreamResponse", async () => {
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(createUIMessageStreamResponse).toHaveBeenCalledOnce()
  })

  it("defaults section to 'personal' when currentSection is omitted", async () => {
    const { buildFormAssistantAgentSystemPrompt } = await import("@/lib/agents/form-assistant/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(buildFormAssistantAgentSystemPrompt).toHaveBeenCalledWith("en", "personal", expect.any(String))
  })

  it("passes the provided currentSection to the prompt builder", async () => {
    const { buildFormAssistantAgentSystemPrompt } = await import("@/lib/agents/form-assistant/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE, currentSection: "income" }))
    expect(buildFormAssistantAgentSystemPrompt).toHaveBeenCalledWith("en", "income", expect.any(String))
  })

  it("defaults to 'en' when no language is provided", async () => {
    const { buildFormAssistantAgentSystemPrompt } = await import("@/lib/agents/form-assistant/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(buildFormAssistantAgentSystemPrompt).toHaveBeenCalledWith("en", expect.any(String), expect.any(String))
  })

  it("uses the provided language when it is a supported locale", async () => {
    const { buildFormAssistantAgentSystemPrompt } = await import("@/lib/agents/form-assistant/prompts")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE, language: "zh-CN" }))
    expect(buildFormAssistantAgentSystemPrompt).toHaveBeenCalledWith("zh-CN", expect.any(String), expect.any(String))
  })
})
