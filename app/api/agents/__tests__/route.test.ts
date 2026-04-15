/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Unit tests for POST /api/agents (Supervisor agent).
 *
 * Strategy: mock auth, generateText (intent classification), and all specialist
 * route handlers. The supervisor's dynamic imports are intercepted by static
 * vi.mock declarations — Vitest intercepts dynamic imports too.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Mock declarations ─────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn(),
}))

vi.mock("@/lib/server/logger", () => ({
  logServerError: vi.fn(),
  logServerInfo: vi.fn(),
}))

vi.mock("@/lib/masshealth/ollama-provider", () => ({
  getOllamaModel: vi.fn().mockReturnValue("ollama.llama3"),
}))

// Mock all specialist routes so dynamic imports resolve to these stubs.
const mockSpecialistResponse = new Response('{"ok":true}', { status: 200 })

vi.mock("@/app/api/agents/benefit-advisor/route", () => ({
  POST: vi.fn().mockResolvedValue(mockSpecialistResponse),
}))
vi.mock("@/app/api/agents/form-assistant/route", () => ({
  POST: vi.fn().mockResolvedValue(mockSpecialistResponse),
}))
vi.mock("@/app/api/agents/intake/route", () => ({
  POST: vi.fn().mockResolvedValue(mockSpecialistResponse),
}))
vi.mock("@/app/api/agents/chat/route", () => ({
  POST: vi.fn().mockResolvedValue(mockSpecialistResponse),
}))

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn().mockReturnValue(Symbol("outputSpec")),
  },
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { POST } from "@/app/api/agents/route"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { generateText } from "ai"

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_ID = "11111111-1111-4111-8111-111111111111"
const ONE_USER_MESSAGE = [{ role: "user", content: "Am I eligible for MassHealth?" }]

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function mockIntent(intent: "benefit_advisor" | "form_assistant" | "intake" | "general") {
  vi.mocked(generateText).mockResolvedValue({ output: { intent } } as never)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthenticatedUser).mockResolvedValue({ ok: true, userId: USER_ID } as never)
  mockIntent("general")
})

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("POST /api/agents (supervisor) — auth", () => {
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

describe("POST /api/agents (supervisor) — validation", () => {
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
})

// ── Intent routing ────────────────────────────────────────────────────────────

describe("POST /api/agents (supervisor) — intent routing", () => {
  it("routes benefit_advisor intent to the benefit-advisor handler", async () => {
    mockIntent("benefit_advisor")
    const { POST: benefitPOST } = await import("@/app/api/agents/benefit-advisor/route")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(benefitPOST).toHaveBeenCalledOnce()
  })

  it("routes form_assistant intent to the form-assistant handler", async () => {
    mockIntent("form_assistant")
    const { POST: formPOST } = await import("@/app/api/agents/form-assistant/route")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(formPOST).toHaveBeenCalledOnce()
  })

  it("routes intake intent to the intake handler", async () => {
    mockIntent("intake")
    const { POST: intakePOST } = await import("@/app/api/agents/intake/route")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(intakePOST).toHaveBeenCalledOnce()
  })

  it("routes general intent to the chat handler", async () => {
    mockIntent("general")
    const { POST: chatPOST } = await import("@/app/api/agents/chat/route")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(chatPOST).toHaveBeenCalledOnce()
  })

  it("falls back to general/chat when classification throws", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("LLM timeout"))
    const { POST: chatPOST } = await import("@/app/api/agents/chat/route")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(chatPOST).toHaveBeenCalledOnce()
  })

  it("passes the original request body to the specialist handler", async () => {
    mockIntent("benefit_advisor")
    const { POST: benefitPOST } = await import("@/app/api/agents/benefit-advisor/route")
    await POST(makeRequest({ messages: ONE_USER_MESSAGE, language: "es" }))

    const [forwardedRequest] = vi.mocked(benefitPOST).mock.calls[0]
    const body = await forwardedRequest.json()
    expect(body.language).toBe("es")
    expect(body.messages).toHaveLength(1)
  })

  it("calls generateText once per request for intent classification", async () => {
    await POST(makeRequest({ messages: ONE_USER_MESSAGE }))
    expect(generateText).toHaveBeenCalledOnce()
  })
})
