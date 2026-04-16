/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * POST /api/agents/intake
 *
 * Phase 2 ReAct agent — structured one-question-at-a-time interview for
 * MassHealth application intake. The LLM calls extract_household_hints to
 * avoid re-asking for information the user already stated.
 *
 * Tool loop (up to 3 steps):
 *   [extract_household_hints?] → stream next interview question
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from "ai"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { isSupportedLanguage } from "@/lib/i18n/languages"
import { logServerError, logServerInfo } from "@/lib/server/logger"
import { buildIntakeTools } from "@/lib/agents/intake/tools"
import { buildIntakeAgentSystemPrompt } from "@/lib/agents/intake/prompts"
import type { ChatMessage } from "@/lib/masshealth/types"

export const runtime = "nodejs"

const AGENT = "intake"

// ── Zod schema ────────────────────────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6000),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  language: z.string().optional(),
  applicationType: z.string().trim().max(64).optional(),
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

    // Provide the last user message to the tools so hint extraction is focused.
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""

    const requestStart = Date.now()
    logServerInfo(`${AGENT}.request`, {
      userId: authResult.userId,
      language,
      applicationType: payload.applicationType,
      messageCount: messages.length,
    })

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        async execute({ writer }) {
          // Write a minimal annotation so the client knows we are in-scope.
          writer.write({
            type: "data-masshealth" as `data-${string}`,
            data: { ok: true, outOfScope: false },
          })

          const result = streamText({
            model: getOllamaModel(),
            system: buildIntakeAgentSystemPrompt(language, payload.applicationType),
            messages,
            tools: buildIntakeTools(lastUserMessage),
            stopWhen: stepCountIs(3),
            temperature: 0.2,
            abortSignal: AbortSignal.timeout(90_000),
            onStepFinish({ stepNumber, toolCalls, usage, finishReason }) {
              logServerInfo(`${AGENT}.step`, {
                stepNumber,
                tools: toolCalls.map((tc) => tc.toolName),
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                finishReason,
                elapsedMs: Date.now() - requestStart,
              })
            },
            onFinish({ steps, totalUsage }) {
              logServerInfo(`${AGENT}.done`, {
                totalSteps: steps.length,
                totalInputTokens: totalUsage.inputTokens,
                totalOutputTokens: totalUsage.outputTokens,
                elapsedMs: Date.now() - requestStart,
              })
            },
          })

          writer.merge(result.toUIMessageStream())
        },
        onError(error) {
          logServerError(`${AGENT}.error`, error, { route: "/api/agents/intake", elapsedMs: Date.now() - requestStart })
          return "Unable to complete the intake request."
        },
      }),
    })
  } catch (error) {
    logServerError(`${AGENT}.fatal`, error, { route: "/api/agents/intake", method: "POST" })
    const isValidation = error instanceof z.ZodError
    return NextResponse.json(
      { ok: false, error: isValidation ? "Invalid request payload." : "Unable to complete request." },
      { status: isValidation ? 400 : 500 },
    )
  }
}
