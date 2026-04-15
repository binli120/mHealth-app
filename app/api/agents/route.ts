/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * POST /api/agents  —  Supervisor agent
 *
 * Single-endpoint entry point for clients that don't know in advance which
 * specialist agent to call.  The supervisor classifies the user's latest
 * message and forwards the request body to the appropriate agent route.
 *
 * Intent → specialist mapping:
 *   benefit_advisor  → /api/agents/benefit-advisor
 *   form_assistant   → /api/agents/form-assistant
 *   intake           → /api/agents/intake
 *   general          → /api/agents/chat
 *
 * Note: The appeal and vision agents require structured inputs that cannot
 * be inferred from a general chat message.  Clients that need those agents
 * should call them directly.
 *
 * Body: same shape as /api/agents/benefit-advisor — { messages, language? }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { generateText, Output } from "ai"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { logServerError, logServerInfo } from "@/lib/server/logger"

// ── Intent schema ─────────────────────────────────────────────────────────────

const INTENTS = ["benefit_advisor", "form_assistant", "intake", "general"] as const
type Intent = (typeof INTENTS)[number]

const intentOutputSchema = z.object({
  intent: z.enum(INTENTS),
})

// ── Routing map ───────────────────────────────────────────────────────────────

const INTENT_PATHS: Record<Intent, string> = {
  benefit_advisor: "/api/agents/benefit-advisor",
  form_assistant: "/api/agents/form-assistant",
  intake: "/api/agents/intake",
  general: "/api/agents/chat",
}

// ── Request schema ────────────────────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6000),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  language: z.string().optional(),
})

// ── Intent classification ─────────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You are an intent classifier for a MassHealth benefits application.
Given a user message, choose exactly one intent from the allowed values.

Intent definitions:
- benefit_advisor: The user wants to know what MassHealth programs they qualify for,
  asks about eligibility, income limits, or needs a benefits recommendation.
- form_assistant: The user is filling out a MassHealth application form and needs help
  completing specific fields, sections, or understanding form questions.
- intake: The user wants to start a new MassHealth application or is in the middle of
  providing their personal/household/income details for the first time.
- general: Any other MassHealth question — program information, policy explanations,
  appeal procedures, document requirements, or general assistance.

Return ONLY a JSON object matching the schema. Do not explain your choice.`

async function classifyIntent(lastMessage: string): Promise<Intent> {
  try {
    const result = await generateText({
      model: getOllamaModel(),
      output: Output.object({ schema: intentOutputSchema }),
      system: CLASSIFY_SYSTEM,
      prompt: `User message: "${lastMessage}"`,
      temperature: 0,
      abortSignal: AbortSignal.timeout(15_000),
    })
    return result.output.intent
  } catch {
    // On classification failure, fall back to general chat
    return "general"
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    // Read the body once — we'll pass it verbatim to the specialist agent.
    const bodyText = await request.text()
    const body = JSON.parse(bodyText)
    const payload = requestSchema.parse(body)

    const lastUserMessage = [...payload.messages].reverse().find((m) => m.role === "user")

    if (!lastUserMessage) {
      return NextResponse.json({ ok: false, error: "At least one user message is required." }, { status: 400 })
    }

    const requestStart = Date.now()

    // ── Classify intent ───────────────────────────────────────────────────────
    const intent = await classifyIntent(lastUserMessage.content)
    const targetPath = INTENT_PATHS[intent]

    logServerInfo("supervisor.route", {
      userId: authResult.userId,
      intent,
      targetPath,
      elapsedMs: Date.now() - requestStart,
    })

    // ── Forward to specialist agent ───────────────────────────────────────────
    // Reconstruct a fresh Request so the specialist can read the body again.
    // We preserve the original headers (including auth cookies/tokens).
    const targetUrl = new URL(targetPath, request.url)
    const downstreamRequest = new Request(targetUrl.toString(), {
      method: "POST",
      headers: request.headers,
      body: bodyText,
    })

    // Dynamically import the target handler to avoid circular-dependency risks
    // and keep the supervisor independent of specialist implementation details.
    const handlers: Record<Intent, () => Promise<{ POST: (req: Request) => Promise<Response> }>> = {
      benefit_advisor: () => import("@/app/api/agents/benefit-advisor/route"),
      form_assistant: () => import("@/app/api/agents/form-assistant/route"),
      intake: () => import("@/app/api/agents/intake/route"),
      general: () => import("@/app/api/agents/chat/route"),
    }

    const { POST: specialistPOST } = await handlers[intent]()
    return specialistPOST(downstreamRequest)
  } catch (error) {
    logServerError("supervisor.fatal", error, { route: "/api/agents", method: "POST" })
    const isValidation = error instanceof z.ZodError
    return NextResponse.json(
      { ok: false, error: isValidation ? "Invalid request payload." : "Unable to route request." },
      { status: isValidation ? 400 : 500 },
    )
  }
}
