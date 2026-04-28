/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * POST /api/agents/form-assistant
 *
 * Phase 2 ReAct agent — the LLM calls tools to parse form fields and fetch
 * policy context, then asks for the next missing field in the active section.
 *
 * Tool loop (up to 4 steps):
 *   extract_form_fields → [retrieve_policy?] → stream reply
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from "ai"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { isSupportedLanguage } from "@/lib/i18n/languages"
import { logServerError, logServerInfo } from "@/lib/server/logger"
import { incrementCounter } from "@/lib/server/counters"
import { buildFormAssistantTools } from "@/lib/agents/form-assistant/tools"
import { buildFormAssistantAgentSystemPrompt } from "@/lib/agents/form-assistant/prompts"
import { FORM_ASSISTANT_SECTIONS } from "@/app/api/chat/masshealth/constants"
import type { ChatMessage } from "@/lib/masshealth/types"
import type { HouseholdMember, IncomeSource } from "@/lib/redux/features/application-slice"
import type { FormSection } from "@/lib/masshealth/form-sections"

export const runtime = "nodejs"

const AGENT = "form-assistant"

// ── Zod schemas ───────────────────────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(6000),
})

const householdMemberSchema = z.object({
  id: z.string(),
  firstName: z.string().max(100).default(""),
  lastName: z.string().max(100).default(""),
  relationship: z.string().max(64).default(""),
  dob: z.string().max(20).default(""),
  ssn: z.string().max(11).default(""),
  pregnant: z.boolean().default(false),
  disabled: z.boolean().default(false),
  over65: z.boolean().default(false),
})

const incomeSourceSchema = z.object({
  id: z.string(),
  type: z.string().max(64).default("other"),
  employer: z.string().max(200).default(""),
  amount: z.string().max(32).default(""),
  frequency: z.string().max(32).default("monthly"),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  language: z.string().optional(),
  currentSection: z.enum(FORM_ASSISTANT_SECTIONS).optional(),
  currentFields: z.string().max(2000).optional(),
  existingMembers: z.array(householdMemberSchema).max(20).optional(),
  existingSources: z.array(incomeSourceSchema).max(20).optional(),
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
    const currentSection: FormSection = (payload.currentSection as FormSection) ?? "personal"
    const collectedSummary = payload.currentFields ?? ""
    // Scrub SSN before any field reaches the LLM — PHI must never flow through
    // the AI context.  The `ssn` field is accepted by the Zod schema only so
    // existing Redux state serialises without an error; it is zeroed out here
    // and never forwarded to the model or logged.
    const existingMembers = (payload.existingMembers ?? []).map(
      (m) => ({ ...m, ssn: "" }),
    ) as (HouseholdMember & { id: string })[]
    const existingSources = (payload.existingSources ?? []) as (IncomeSource & { id: string })[]

    const requestStart = Date.now()
    logServerInfo(`${AGENT}.request`, {
      userId: authResult.userId,
      language,
      currentSection,
      messageCount: messages.length,
      existingMemberCount: existingMembers.length,
      existingSourceCount: existingSources.length,
    })

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        async execute({ writer }) {
          const result = streamText({
            model: getOllamaModel(),
            system: buildFormAssistantAgentSystemPrompt(language, currentSection, collectedSummary),
            messages,
            tools: buildFormAssistantTools(
              { messages, language, collectedSummary, currentSection, existingMembers, existingSources },
              writer,
            ),
            stopWhen: stepCountIs(4),
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
          logServerError(`${AGENT}.error`, error, { route: "/api/agents/form-assistant", elapsedMs: Date.now() - requestStart })
          return "Unable to complete the form assistant request."
        },
      }),
    })
  } catch (error) {
    logServerError(`${AGENT}.fatal`, error, { route: "/api/agents/form-assistant", method: "POST" })
    const isValidation = error instanceof z.ZodError
    return NextResponse.json(
      { ok: false, error: isValidation ? "Invalid request payload." : "Unable to complete request." },
      { status: isValidation ? 400 : 500 },
    )
  }
}
