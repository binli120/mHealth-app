/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * POST /api/agents/chat
 *
 * General MassHealth assistant agent — answers policy questions, explains
 * programs, and guides residents through the MassHealth ecosystem.
 *
 * Before entering the ReAct loop, an out-of-scope guard checks whether the
 * conversation is about MassHealth.  Off-topic messages receive a polite
 * redirect without consuming an LLM call.
 *
 * Tool loop (up to 3 steps):
 *   [retrieve_policy?] → stream plain-language answer
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from "ai"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { isSupportedLanguage } from "@/lib/i18n/languages"
import { logServerError, logServerInfo } from "@/lib/server/logger"
import { isMassHealthTopic, getMassHealthOutOfScopeResponse } from "@/lib/masshealth/chat-knowledge"
import { buildChatTools } from "@/lib/agents/chat/tools"
import { buildChatAgentSystemPrompt } from "@/lib/agents/chat/prompts"
import type { ChatMessage } from "@/lib/masshealth/types"

export const runtime = "nodejs"

const AGENT = "chat"

// ── Zod schema ────────────────────────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6000),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  language: z.string().optional(),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Number of recent user messages to scan when deciding if the conversation
 *  is MassHealth-related (mirrors the monolithic route behavior). */
const RECENT_USER_MSG_SCAN = 3

function isMassHealthConversation(messages: ChatMessage[]): boolean {
  const recentUserMessages = messages
    .filter((m) => m.role === "user")
    .slice(-RECENT_USER_MSG_SCAN)
  return recentUserMessages.some((m) => isMassHealthTopic(m.content))
}

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
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")

    if (!lastUserMessage) {
      return NextResponse.json({ ok: false, error: "At least one user message is required." }, { status: 400 })
    }

    const requestStart = Date.now()
    logServerInfo(`${AGENT}.request`, { userId: authResult.userId, language, messageCount: messages.length })

    // ── Out-of-scope guard ────────────────────────────────────────────────────
    // Skip the LLM entirely when the conversation isn't about MassHealth.
    if (!isMassHealthTopic(lastUserMessage.content) && !isMassHealthConversation(messages)) {
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute({ writer }) {
            writer.write({
              type: "data-masshealth" as `data-${string}`,
              data: {
                ok: true,
                outOfScope: true,
                reply: getMassHealthOutOfScopeResponse(language),
              },
            })
          },
        }),
      })
    }

    // ── In-scope: ReAct loop with optional RAG retrieval ──────────────────────
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        async execute({ writer }) {
          // Signal to the client that this response is in-scope.
          writer.write({
            type: "data-masshealth" as `data-${string}`,
            data: { ok: true, outOfScope: false },
          })

          const result = streamText({
            model: getOllamaModel(),
            system: buildChatAgentSystemPrompt(language),
            messages,
            tools: buildChatTools(),
            stopWhen: stepCountIs(3),
            temperature: 0.3,
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
          logServerError(`${AGENT}.error`, error, { route: "/api/agents/chat", elapsedMs: Date.now() - requestStart })
          return "Unable to complete the chat request."
        },
      }),
    })
  } catch (error) {
    logServerError(`${AGENT}.fatal`, error, { route: "/api/agents/chat", method: "POST" })
    const isValidation = error instanceof z.ZodError
    return NextResponse.json(
      { ok: false, error: isValidation ? "Invalid request payload." : "Unable to complete request." },
      { status: isValidation ? 400 : 500 },
    )
  }
}
