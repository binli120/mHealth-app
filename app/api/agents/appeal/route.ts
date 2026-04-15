/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * POST /api/agents/appeal
 *
 * Phase 2 ReAct agent — generates a MassHealth appeal letter. The LLM calls
 * retrieve_policy to ground the letter in accurate policy, then calls
 * finish_appeal to commit the structured output (explanation, letter,
 * evidence checklist) as a data annotation before streaming a brief summary.
 *
 * Tool loop (up to 3 steps):
 *   retrieve_policy → finish_appeal → stream summary
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from "ai"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { isSupportedLanguage } from "@/lib/i18n/languages"
import { logServerError, logServerInfo } from "@/lib/server/logger"
import { incrementCounter } from "@/lib/server/counters"
import { buildAppealTools } from "@/lib/agents/appeal/tools"
import { buildAppealAgentSystemPrompt } from "@/lib/agents/appeal/prompts"
import { APPEAL_DENIAL_REASONS, APPEAL_DENIAL_REASON_IDS, APPEAL_DETAILS_MAX_LENGTH } from "@/lib/appeals/constants"

export const runtime = "nodejs"

const AGENT = "appeal"

// ── Zod schema ────────────────────────────────────────────────────────────────

const requestSchema = z.object({
  denialReasonId: z.enum(APPEAL_DENIAL_REASON_IDS),
  denialDetails: z.string().trim().max(APPEAL_DETAILS_MAX_LENGTH).default(""),
  documentText: z.string().trim().max(8000).optional(),
  language: z.string().optional(),
})

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json()
    const payload = requestSchema.parse(body)

    const denialReason = APPEAL_DENIAL_REASONS.find((r) => r.id === payload.denialReasonId)
    if (!denialReason) {
      return NextResponse.json({ ok: false, error: "Invalid denial reason." }, { status: 400 })
    }

    const language = payload.language && isSupportedLanguage(payload.language)
      ? payload.language
      : "en"

    // Compose a single user message from the structured denial input so the
    // LLM has all the context it needs without a multi-turn conversation.
    const userMessage = [
      `Denial reason: ${denialReason.label}`,
      `Denial description: ${denialReason.description}`,
      payload.denialDetails ? `Additional details provided by applicant: ${payload.denialDetails}` : null,
      payload.documentText ? `Text extracted from denial letter document:\n${payload.documentText}` : null,
    ]
      .filter(Boolean)
      .join("\n\n")

    const requestStart = Date.now()
    logServerInfo(`${AGENT}.request`, {
      userId: authResult.userId,
      denialReasonId: payload.denialReasonId,
      language,
      hasDocumentText: Boolean(payload.documentText),
    })

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        async execute({ writer }) {
          const result = streamText({
            model: getOllamaModel(),
            system: buildAppealAgentSystemPrompt(denialReason, language),
            messages: [{ role: "user", content: userMessage }],
            // finish_appeal closes over writer to write the structured annotation.
            tools: buildAppealTools(writer),
            stopWhen: stepCountIs(3),
            temperature: 0.3,
            abortSignal: AbortSignal.timeout(120_000),
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
          logServerError(`${AGENT}.error`, error, { route: "/api/agents/appeal", elapsedMs: Date.now() - requestStart })
          return "Unable to generate the appeal letter."
        },
      }),
    })
  } catch (error) {
    logServerError(`${AGENT}.fatal`, error, { route: "/api/agents/appeal", method: "POST" })
    const isValidation = error instanceof z.ZodError
    return NextResponse.json(
      { ok: false, error: isValidation ? "Invalid request payload." : "Unable to complete request." },
      { status: isValidation ? 400 : 500 },
    )
  }
}
