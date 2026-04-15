/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for POST /api/agents/chat.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
// vi.hoisted runs before vi.mock so fakeWriter is available inside the factory.

const { fakeWriter } = vi.hoisted(() => {
  const fakeWriter = { write: vi.fn(), merge: vi.fn() }
  return { fakeWriter }
})

// ── Mock declarations ─────────────────────────────────────────────────────────

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

vi.mock("@/lib/masshealth/chat-knowledge", () => ({
  isMassHealthTopic: vi.fn(),
  getMassHealthOutOfScopeResponse: vi.fn().mockReturnValue("I can only help with MassHealth topics."),
}))

vi.mock("@/lib/agents/chat/tools", () => ({
  buildChatTools: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/agents/chat/prompts", () => ({
  buildChatAgentSystemPrompt: vi.fn().mockReturnValue("chat-system-prompt"),
}))

vi.mock("ai", () => ({
  createUIMessageStream: vi.fn(({ execute }: { execute: (ctx: { writer: typeof fakeWriter }) => void }) => {
    execute({ writer: fakeWriter })
    return Symbol("fakeStream")
  }),
  createUIMessageStreamResponse: vi.fn(() => new Response('{"ok":true}', { status: 200 })),
  streamText: vi.fn().mockReturnValue({ toUIMessageStream: vi.fn().mockReturnValue(Symbol("textStream")) }),
  stepCountIs: vi.fn().mockReturnValue(() => false),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { POST } from "@/app/api/agents/chat/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { isMassHealthTopic } from "@/lib/masshealth/chat-knowledge"
import { createUIMessageStreamResponse, streamText } from "ai"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const IN_SCOPE_MSG = [{ role: "user", content: "Am I eligible for MassHealth?" }]
const OFF_TOPIC_MSG = [{ role: "user", content: "What is the weather today?" }]

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/agents/chat", {
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
})

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("POST /api/agents/chat — auth", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireAuthenticatedUser).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }),
    } as never)

    const response = await POST(makeRequest({ messages: IN_SCOPE_MSG }))
    expect(response.status).toBe(401)
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe("POST /api/agents/chat — validation", () => {
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

  it("returns 400 when message role is invalid", async () => {
    const response = await POST(makeRequest({ messages: [{ role: "system", content: "hello" }] }))
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.error).toMatch(/invalid request payload/i)
  })
})

// ── Out-of-scope guard ────────────────────────────────────────────────────────

describe("POST /api/agents/chat — out-of-scope guard", () => {
  it("does NOT call streamText when the message is off-topic", async () => {
    vi.mocked(isMassHealthTopic).mockReturnValue(false)
    await POST(makeRequest({ messages: OFF_TOPIC_MSG }))
    expect(streamText).not.toHaveBeenCalled()
  })

  it("writes outOfScope:true annotation for off-topic messages", async () => {
    vi.mocked(isMassHealthTopic).mockReturnValue(false)
    await POST(makeRequest({ messages: OFF_TOPIC_MSG }))

    const writeCall = vi.mocked(fakeWriter.write).mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(writeCall?.data?.outOfScope).toBe(true)
  })

  it("still returns 200 for out-of-scope messages", async () => {
    vi.mocked(isMassHealthTopic).mockReturnValue(false)
    const response = await POST(makeRequest({ messages: OFF_TOPIC_MSG }))
    expect(response.status).toBe(200)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/agents/chat — happy path", () => {
  it("returns 200 for a valid in-scope request", async () => {
    const response = await POST(makeRequest({ messages: IN_SCOPE_MSG }))
    expect(response.status).toBe(200)
  })

  it("delegates to createUIMessageStreamResponse", async () => {
    await POST(makeRequest({ messages: IN_SCOPE_MSG }))
    expect(createUIMessageStreamResponse).toHaveBeenCalledOnce()
  })

  it("calls streamText for in-scope messages", async () => {
    await POST(makeRequest({ messages: IN_SCOPE_MSG }))
    expect(streamText).toHaveBeenCalledOnce()
  })

  it("defaults to 'en' when no language is provided", async () => {
    const { buildChatAgentSystemPrompt } = await import("@/lib/agents/chat/prompts")
    await POST(makeRequest({ messages: IN_SCOPE_MSG }))
    expect(buildChatAgentSystemPrompt).toHaveBeenCalledWith("en")
  })

  it("uses the provided language when it is a supported locale", async () => {
    const { buildChatAgentSystemPrompt } = await import("@/lib/agents/chat/prompts")
    await POST(makeRequest({ messages: IN_SCOPE_MSG, language: "vi" }))
    expect(buildChatAgentSystemPrompt).toHaveBeenCalledWith("vi")
  })

  it("falls back to 'en' for an unsupported language code", async () => {
    const { buildChatAgentSystemPrompt } = await import("@/lib/agents/chat/prompts")
    await POST(makeRequest({ messages: IN_SCOPE_MSG, language: "klingon" }))
    expect(buildChatAgentSystemPrompt).toHaveBeenCalledWith("en")
  })
})
