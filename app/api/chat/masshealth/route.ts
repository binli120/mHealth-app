import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

import {
  buildBenefitAdvisorSystemPrompt,
  buildFormAssistantSystemPrompt,
  buildMassHealthIntakeSystemPrompt,
  buildMassHealthSystemPrompt,
  buildMassHealthSystemPromptWithContext,
  getMassHealthOutOfScopeResponse,
  isMassHealthTopic,
  type ChatMessage,
} from "@/lib/masshealth/chat-knowledge"
import {
  applyFactDefaults,
  extractEligibilityFacts,
  isSufficientForEvaluation,
} from "@/lib/masshealth/fact-extraction"
import {
  extractFormFields,
  type FormSection,
} from "@/lib/masshealth/form-field-extraction"
import type { HouseholdMember, IncomeSource } from "@/lib/redux/features/application-slice"
import { runEligibilityCheck } from "@/lib/eligibility-engine"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import { extractHouseholdRelationshipHints } from "@/lib/masshealth/household-relationships"
import { logServerError } from "@/lib/server/logger"
import { isSupportedLanguage, type SupportedLanguage } from "@/lib/i18n/languages"
import {
  CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  CHAT_MESSAGE_CONTENT_MIN_LENGTH,
  CHAT_MESSAGE_ROLE_USER,
  CHAT_MESSAGE_ROLES,
  CHAT_REQUEST_MODE_APPLICATION_INTAKE,
  CHAT_REQUEST_MODE_BENEFIT_ADVISOR,
  CHAT_REQUEST_MODE_FORM_ASSISTANT,
  CHAT_REQUEST_MODES,
  CHAT_REQUEST_MAX_MESSAGES,
  CHAT_REQUEST_MIN_MESSAGES,
  DEFAULT_CHAT_LANGUAGE,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  ERROR_CHAT_REQUEST_FAILED,
  ERROR_INVALID_REQUEST_PAYLOAD,
  ERROR_LOG_PREFIX,
  ERROR_OLLAMA_EMPTY_RESPONSE,
  ERROR_OLLAMA_RESPONSE,
  ERROR_USER_MESSAGE_REQUIRED,
  FORM_ASSISTANT_SECTIONS,
  MASSHEALTH_CONVERSATION_RECENT_USER_MESSAGES,
  OLLAMA_CHAT_ENDPOINT,
  OLLAMA_MESSAGES_CONTEXT_LIMIT,
  OLLAMA_TEMPERATURE,
  OLLAMA_TIMEOUT_MS,
  RAG_TOP_K,
  RAG_TOP_K_ADVISOR,
} from "./constants"

export const runtime = "nodejs"

const chatMessageSchema = z.object({
  role: z.enum(CHAT_MESSAGE_ROLES),
  content: z.string().trim().min(CHAT_MESSAGE_CONTENT_MIN_LENGTH).max(CHAT_MESSAGE_CONTENT_MAX_LENGTH),
})

const requestSchema = z.object({
  messages: z.array(chatMessageSchema).min(CHAT_REQUEST_MIN_MESSAGES).max(CHAT_REQUEST_MAX_MESSAGES),
  language: z.string().optional(),
  mode: z.enum(CHAT_REQUEST_MODES).optional(),
  applicationType: z.string().trim().max(64).optional(),
  // form_assistant mode extras
  currentFields: z.string().max(2000).optional(),
  currentSection: z.enum(FORM_ASSISTANT_SECTIONS).optional(),
  existingMembers: z.array(z.unknown()).optional(),
  existingSources: z.array(z.unknown()).optional(),
})

interface OllamaResponsePayload {
  message?: {
    role?: string
    content?: string
  }
}

function getLastUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index]
    if (item.role === CHAT_MESSAGE_ROLE_USER) {
      return item
    }
  }
  return undefined
}

function buildOllamaMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-OLLAMA_MESSAGES_CONTEXT_LIMIT)
}

function isMassHealthConversation(messages: ChatMessage[]): boolean {
  const recentUserMessages = messages
    .filter((message) => message.role === CHAT_MESSAGE_ROLE_USER)
    .slice(-MASSHEALTH_CONVERSATION_RECENT_USER_MESSAGES)

  return recentUserMessages.some((message) => isMassHealthTopic(message.content))
}

function getOllamaBaseUrl(): string {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL
  return baseUrl.replace(/\/+$/, "")
}

function resolveLanguage(input: string | undefined): SupportedLanguage {
  if (input && isSupportedLanguage(input)) {
    return input
  }
  return DEFAULT_CHAT_LANGUAGE
}

function buildIntakeHouseholdHintsMessage(message: string): string | null {
  const hints = extractHouseholdRelationshipHints(message)
  if (hints.length === 0) {
    return null
  }

  const lines = hints.map((hint) => {
    if (hint.memberName) {
      return `- Household member provided: ${hint.memberName}; relationship to applicant is ${hint.relationship}.`
    }

    return `- Household relationship already provided: ${hint.relationship}.`
  })

  return [
    "Known facts from the latest user message:",
    ...lines,
    "Do not ask for relationship again unless the user corrects it.",
  ].join("\n")
}

function hasRelationshipQuestion(reply: string): boolean {
  const normalized = reply.toLowerCase()
  return (
    normalized.includes("relationship to you") ||
    normalized.includes("relationship with you") ||
    normalized.includes("how is") && normalized.includes("related to you") ||
    normalized.includes("what is") && normalized.includes("relationship")
  )
}

function toPossessive(name: string): string {
  return name.toLowerCase().endsWith("s") ? `${name}'` : `${name}'s`
}

function sanitizeIntakeReply(reply: string, latestUserMessage: string): string {
  const hints = extractHouseholdRelationshipHints(latestUserMessage)
  if (hints.length === 0 || !hasRelationshipQuestion(reply)) {
    return reply
  }

  const primaryHint = hints[0]
  if (primaryHint?.memberName) {
    return `Thanks, I have ${primaryHint.memberName} as your ${primaryHint.relationship}. What is ${toPossessive(primaryHint.memberName)} date of birth (MM/DD/YYYY)?`
  }

  return "Thanks, I have that relationship noted. What is this household member's date of birth (MM/DD/YYYY)?"
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const body = await request.json()
    const payload = requestSchema.parse(body)
    const language = resolveLanguage(payload.language)
    const lastUserMessage = getLastUserMessage(payload.messages)
    const mode = payload.mode

    if (!lastUserMessage) {
      return NextResponse.json(
        {
          ok: false,
          error: ERROR_USER_MESSAGE_REQUIRED,
        },
        { status: 400 },
      )
    }

    const isIntakeMode = mode === CHAT_REQUEST_MODE_APPLICATION_INTAKE
    const isBenefitAdvisorMode = mode === CHAT_REQUEST_MODE_BENEFIT_ADVISOR

    // ── benefit_advisor mode ─────────────────────────────────────────────────
    // LLM extracts facts → rule engine evaluates → LLM explains with RAG backing
    if (isBenefitAdvisorMode) {
      // 1. Extract structured eligibility facts from conversation (LLM JSON extraction)
      const facts = await extractEligibilityFacts(payload.messages, language)

      let eligibilityReport = null
      let ragQuery = lastUserMessage.content

      if (isSufficientForEvaluation(facts)) {
        // 2. Run the rule engine (synchronous, pure logic — not LLM)
        const screenerData = applyFactDefaults(facts)
        eligibilityReport = runEligibilityCheck(screenerData)

        // Build a focused RAG query from the top matched programs
        const topPrograms = eligibilityReport.results
          .slice(0, 3)
          .map((r) => r.program)
          .join(", ")
        ragQuery = topPrograms || lastUserMessage.content
      }

      // 3. Retrieve relevant policy chunks
      const ragChunks = await retrieveRelevantChunks(ragQuery, RAG_TOP_K_ADVISOR).catch(() => [])
      const ragContext = formatChunksForPrompt(ragChunks)

      // 4. Build system prompt with facts + rule engine results + policy context
      const advisorSystemPrompt = buildBenefitAdvisorSystemPrompt(
        language,
        facts,
        eligibilityReport,
        ragContext,
      )

      // 5. Call Ollama to generate the explanation / next question
      const advisorOllamaResponse = await fetch(`${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
          stream: false,
          options: { temperature: OLLAMA_TEMPERATURE },
          messages: [
            { role: "system", content: advisorSystemPrompt },
            ...buildOllamaMessages(payload.messages),
          ],
        }),
      })

      if (!advisorOllamaResponse.ok) {
        const detail = await advisorOllamaResponse.text().catch(() => "")
        return NextResponse.json({ ok: false, error: ERROR_OLLAMA_RESPONSE, detail }, { status: 502 })
      }

      const advisorData = (await advisorOllamaResponse.json()) as OllamaResponsePayload
      const advisorReply = advisorData.message?.content?.trim()

      if (!advisorReply) {
        return NextResponse.json({ ok: false, error: ERROR_OLLAMA_EMPTY_RESPONSE }, { status: 502 })
      }

      return NextResponse.json({
        ok: true,
        outOfScope: false,
        reply: advisorReply,
        // Include structured data for UI consumption (optional rendering)
        factsExtracted: facts,
        eligibilityResults: eligibilityReport
          ? {
              fplPercent: eligibilityReport.fplPercent,
              annualFPL: eligibilityReport.annualFPL,
              summary: eligibilityReport.summary,
              results: eligibilityReport.results.map((r) => ({
                program: r.program,
                status: r.status,
                tagline: r.tagline,
                actionLabel: r.actionLabel,
                actionHref: r.actionHref,
                color: r.color,
              })),
            }
          : null,
      })
    }

    // ── form_assistant mode ───────────────────────────────────────────────────
    // Structured form field extraction + section-aware guidance + optional RAG
    if (mode === CHAT_REQUEST_MODE_FORM_ASSISTANT) {
      const collectedSummary = payload.currentFields ?? ""
      const currentSection: FormSection = (payload.currentSection as FormSection) ?? "personal"

      // Run field extraction and optional RAG retrieval in parallel
      const [extractionResult, ragChunks] = await Promise.all([
        extractFormFields(
          payload.messages,
          collectedSummary,
          currentSection,
          (payload.existingMembers ?? []) as HouseholdMember[],
          (payload.existingSources ?? []) as IncomeSource[],
          language,
        ),
        isMassHealthTopic(lastUserMessage.content)
          ? retrieveRelevantChunks(lastUserMessage.content, RAG_TOP_K).catch(() => [])
          : Promise.resolve([]),
      ])

      const ragContext = formatChunksForPrompt(ragChunks)
      const formSystemPrompt = buildFormAssistantSystemPrompt(language, collectedSummary, currentSection, ragContext || undefined)

      const formOllamaResponse = await fetch(`${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
          stream: false,
          options: { temperature: OLLAMA_TEMPERATURE },
          messages: [
            { role: "system", content: formSystemPrompt },
            ...buildOllamaMessages(payload.messages),
          ],
        }),
      })

      if (!formOllamaResponse.ok) {
        const detail = await formOllamaResponse.text().catch(() => "")
        return NextResponse.json({ ok: false, error: ERROR_OLLAMA_RESPONSE, detail }, { status: 502 })
      }

      const formData = (await formOllamaResponse.json()) as OllamaResponsePayload
      const formReply = formData.message?.content?.trim()

      if (!formReply) {
        return NextResponse.json({ ok: false, error: ERROR_OLLAMA_EMPTY_RESPONSE }, { status: 502 })
      }

      return NextResponse.json({
        ok: true,
        reply: formReply,
        extractedFields: extractionResult.fields,
        noHouseholdMembers: extractionResult.noHouseholdMembers,
        noIncome: extractionResult.noIncome,
      })
    }

    // ── Existing modes (assistant + application_intake) ───────────────────────

    const intakeHouseholdHintsMessage = isIntakeMode
      ? buildIntakeHouseholdHintsMessage(lastUserMessage.content)
      : null

    if (!isIntakeMode && !isMassHealthTopic(lastUserMessage.content) && !isMassHealthConversation(payload.messages)) {
      return NextResponse.json({
        ok: true,
        outOfScope: true,
        reply: getMassHealthOutOfScopeResponse(language),
      })
    }

    // For assistant mode: augment with RAG context if available
    let assistantSystemPrompt: string
    if (isIntakeMode) {
      assistantSystemPrompt = buildMassHealthIntakeSystemPrompt(language, payload.applicationType)
    } else {
      // Retrieve policy chunks semantically relevant to the user's question
      const ragChunks = await retrieveRelevantChunks(lastUserMessage.content, RAG_TOP_K).catch(() => [])
      const ragContext = formatChunksForPrompt(ragChunks)
      assistantSystemPrompt = ragContext
        ? buildMassHealthSystemPromptWithContext(language, ragContext)
        : buildMassHealthSystemPrompt(language)
    }

    const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL
    const ollamaResponse = await fetch(`${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: false,
        options: {
          temperature: OLLAMA_TEMPERATURE,
        },
        messages: [
          {
            role: "system",
            content: assistantSystemPrompt,
          },
          ...(intakeHouseholdHintsMessage
            ? [
                {
                  role: "system",
                  content: intakeHouseholdHintsMessage,
                },
              ]
            : []),
          ...buildOllamaMessages(payload.messages),
        ],
      }),
    })

    if (!ollamaResponse.ok) {
      const detail = await ollamaResponse.text().catch(() => "")
      return NextResponse.json(
        {
          ok: false,
          error: ERROR_OLLAMA_RESPONSE,
          detail,
        },
        { status: 502 },
      )
    }

    const data = (await ollamaResponse.json()) as OllamaResponsePayload
    const reply = data.message?.content?.trim()

    if (!reply) {
      return NextResponse.json(
        {
          ok: false,
          error: ERROR_OLLAMA_EMPTY_RESPONSE,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      outOfScope: false,
      reply: isIntakeMode ? sanitizeIntakeReply(reply, lastUserMessage.content) : reply,
    })
  } catch (error) {
    logServerError(ERROR_LOG_PREFIX, error, {
      route: "/api/chat/masshealth",
      method: "POST",
    })

    const isValidationError = error instanceof z.ZodError
    return NextResponse.json(
      {
        ok: false,
        error: isValidationError ? ERROR_INVALID_REQUEST_PAYLOAD : ERROR_CHAT_REQUEST_FAILED,
      },
      { status: isValidationError ? 400 : 500 },
    )
  }
}
