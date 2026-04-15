/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * POST /api/agents/benefit-advisor
 *
 * Phase 2 ReAct agent — the LLM decides which tools to call and in what order.
 * Streaming response via AI SDK v6 UI message stream format.
 *
 * Tool loop (up to 5 steps):
 *   extract_eligibility_facts → check_eligibility → retrieve_policy → stream reply
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from "ai"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { isSupportedLanguage } from "@/lib/i18n/languages"
import { logServerError, logServerInfo } from "@/lib/server/logger"
import { incrementCounter } from "@/lib/server/counters"
import { buildBenefitAdvisorTools } from "@/lib/agents/benefit-advisor/tools"
import { buildBenefitAdvisorAgentSystemPrompt } from "@/lib/agents/benefit-advisor/prompts"
import { loadUserAgentMemory } from "@/lib/agents/memory"
import type { ChatMessage } from "@/lib/masshealth/types"

const AGENT = "benefit-advisor"

export const runtime = "nodejs"

// ── Zod schema ────────────────────────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6000),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  language: z.string().optional(),
})

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json()
    const payload = requestSchema.parse(body)

    const language = payload.language && isSupportedLanguage(payload.language)
      ? payload.language
      : "en"

    const messages = payload.messages as ChatMessage[]

    const requestStart = Date.now()
    logServerInfo(`${AGENT}.request`, { userId: authResult.userId, language, messageCount: messages.length })

    // Phase 4: load persisted facts from prior sessions so the agent never
    // re-asks questions it already knows the answer to.
    const memory = await loadUserAgentMemory(authResult.userId).catch(() => null)
    const knownFactCount = Object.keys(memory?.extractedFacts ?? {}).length
    logServerInfo(`${AGENT}.memory`, { userId: authResult.userId, knownFactCount, hasMemory: !!memory })

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        async execute({ writer }) {
          const result = streamText({
            model: getOllamaModel(),
            system: buildBenefitAdvisorAgentSystemPrompt(language, memory?.extractedFacts ?? {}),
            messages,
            // Tools are built with the writer in closure so check_eligibility
            // can write the eligibility annotation mid-stream.
            tools: buildBenefitAdvisorTools(messages, language, writer, authResult.userId, memory?.extractedFacts ?? {}),
            stopWhen: stepCountIs(5),
            temperature: 0.2,
            abortSignal: AbortSignal.timeout(120_000),
            // Step-level observability: log each tool call and token usage.
            onStepFinish({ stepNumber, toolCalls, usage, finishReason }) {
              logServerInfo(`${AGENT}.step`, {
                stepNumber,
                tools: toolCalls.map((tc) => tc.toolName),
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                finishReason,
                elapsedMs: Date.now() - requestStart,
              })
              for (const tc of toolCalls) {
                incrementCounter("tool_call", { agent: AGENT, tool: tc.toolName })
              }
            },
            onFinish({ steps, totalUsage }) {
              logServerInfo(`${AGENT}.done`, {
                totalSteps: steps.length,
                totalInputTokens: totalUsage.inputTokens,
                totalOutputTokens: totalUsage.outputTokens,
                elapsedMs: Date.now() - requestStart,
              })
              const sequence = steps.flatMap((s) => s.toolCalls.map((tc) => tc.toolName)).join("→")
              if (sequence) {
                incrementCounter("tool_call_sequence", { agent: AGENT, sequence })
              }
            },
          })

          writer.merge(result.toUIMessageStream())
        },
        onError(error) {
          logServerError(`${AGENT}.error`, error, { route: "/api/agents/benefit-advisor", elapsedMs: Date.now() - requestStart })
          return "Unable to complete the benefit advisor request."
        },
      }),
    })
  } catch (error) {
    logServerError("BenefitAdvisorAgent", error, { route: "/api/agents/benefit-advisor", method: "POST" })
    const isValidation = error instanceof z.ZodError
    return NextResponse.json(
      { ok: false, error: isValidation ? "Invalid request payload." : "Unable to complete request." },
      { status: isValidation ? 400 : 500 },
    )
  }
}
