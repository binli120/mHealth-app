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
import { callOllama, OllamaError } from "@/lib/masshealth/ollama-client"
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
  DEFAULT_OLLAMA_MODEL,
  ERROR_CHAT_REQUEST_FAILED,
  ERROR_INVALID_REQUEST_PAYLOAD,
  ERROR_LOG_PREFIX,
  FORM_ASSISTANT_SECTIONS,
  MASSHEALTH_CONVERSATION_RECENT_USER_MESSAGES,
  OLLAMA_MESSAGES_CONTEXT_LIMIT,
  OLLAMA_TEMPERATURE,
  OLLAMA_TIMEOUT_MS,
  RAG_TOP_K,
  RAG_TOP_K_ADVISOR,
} from "./constants"

export const runtime = "nodejs"

// ── Zod schemas ───────────────────────────────────────────────────────────────

const chatMessageSchema = z.object({
  role: z.enum(CHAT_MESSAGE_ROLES),
  content: z.string().trim().min(CHAT_MESSAGE_CONTENT_MIN_LENGTH).max(CHAT_MESSAGE_CONTENT_MAX_LENGTH),
})

// Partial shapes — id optional on first extraction pass
const householdMemberSchema = z.object({
  id: z.string().optional(),
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
  id: z.string().optional(),
  type: z.string().max(64).default("other"),
  employer: z.string().max(200).default(""),
  amount: z.string().max(32).default(""),
  frequency: z.string().max(32).default("monthly"),
})

const requestSchema = z.object({
  messages: z.array(chatMessageSchema).min(CHAT_REQUEST_MIN_MESSAGES).max(CHAT_REQUEST_MAX_MESSAGES),
  language: z.string().optional(),
  mode: z.enum(CHAT_REQUEST_MODES).optional(),
  applicationType: z.string().trim().max(64).optional(),
  // form_assistant mode extras
  currentFields: z.string().max(2000).optional(),
  currentSection: z.enum(FORM_ASSISTANT_SECTIONS).optional(),
  existingMembers: z.array(householdMemberSchema).max(20).optional(),
  existingSources: z.array(incomeSourceSchema).max(20).optional(),
})

type ValidatedPayload = z.infer<typeof requestSchema>

// ── Shared helpers ────────────────────────────────────────────────────────────

function getLastUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index]
    if (item.role === CHAT_MESSAGE_ROLE_USER) return item
  }
  return undefined
}

function buildOllamaMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-OLLAMA_MESSAGES_CONTEXT_LIMIT)
}

function isMassHealthConversation(messages: ChatMessage[]): boolean {
  const recentUserMessages = messages
    .filter((m) => m.role === CHAT_MESSAGE_ROLE_USER)
    .slice(-MASSHEALTH_CONVERSATION_RECENT_USER_MESSAGES)
  return recentUserMessages.some((m) => isMassHealthTopic(m.content))
}

function resolveLanguage(input: string | undefined): SupportedLanguage {
  if (input && isSupportedLanguage(input)) return input
  return DEFAULT_CHAT_LANGUAGE
}

function getModel(): string {
  return process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL
}

function ollamaErrorResponse(err: unknown) {
  if (err instanceof OllamaError) {
    return NextResponse.json({ ok: false, error: err.message, detail: err.detail }, { status: 502 })
  }
  return null
}

// ── Mode handlers ─────────────────────────────────────────────────────────────

async function handleBenefitAdvisor(
  payload: ValidatedPayload,
  lastUserMessage: ChatMessage,
  language: SupportedLanguage,
): Promise<NextResponse> {
  // 1. Extract structured eligibility facts from conversation
  const facts = await extractEligibilityFacts(payload.messages, language)

  let eligibilityReport = null
  let ragQuery = lastUserMessage.content

  if (isSufficientForEvaluation(facts)) {
    const screenerData = applyFactDefaults(facts)
    eligibilityReport = runEligibilityCheck(screenerData)
    const topPrograms = eligibilityReport.results.slice(0, 3).map((r) => r.program).join(", ")
    ragQuery = topPrograms || lastUserMessage.content
  }

  // 2. Retrieve relevant policy chunks
  const ragChunks = await retrieveRelevantChunks(ragQuery, RAG_TOP_K_ADVISOR).catch(() => [])
  const ragContext = formatChunksForPrompt(ragChunks)

  // 3. Build system prompt and call Ollama
  const systemPrompt = buildBenefitAdvisorSystemPrompt(language, facts, eligibilityReport, ragContext)

  let reply: string
  try {
    reply = await callOllama({
      model: getModel(),
      temperature: OLLAMA_TEMPERATURE,
      timeoutMs: OLLAMA_TIMEOUT_MS,
      systemPrompt,
      messages: buildOllamaMessages(payload.messages),
    })
  } catch (err) {
    return ollamaErrorResponse(err) ?? NextResponse.json({ ok: false, error: String(err) }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    outOfScope: false,
    reply,
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

async function handleFormAssistant(
  payload: ValidatedPayload,
  lastUserMessage: ChatMessage,
  language: SupportedLanguage,
): Promise<NextResponse> {
  const collectedSummary = payload.currentFields ?? ""
  const currentSection: FormSection = (payload.currentSection as FormSection) ?? "personal"

  // Run field extraction and RAG retrieval in parallel — single RAG call (P1)
  const [extractionResult, ragChunks] = await Promise.all([
    extractFormFields(
      payload.messages,
      collectedSummary,
      currentSection,
      payload.existingMembers ?? [],
      payload.existingSources ?? [],
      language,
    ),
    isMassHealthTopic(lastUserMessage.content)
      ? retrieveRelevantChunks(lastUserMessage.content, RAG_TOP_K).catch(() => [])
      : Promise.resolve([]),
  ])

  const ragContext = formatChunksForPrompt(ragChunks)
  const systemPrompt = buildFormAssistantSystemPrompt(
    language,
    collectedSummary,
    currentSection,
    ragContext || undefined,
  )

  let reply: string
  try {
    reply = await callOllama({
      model: getModel(),
      temperature: OLLAMA_TEMPERATURE,
      timeoutMs: OLLAMA_TIMEOUT_MS,
      systemPrompt,
      messages: buildOllamaMessages(payload.messages),
    })
  } catch (err) {
    return ollamaErrorResponse(err) ?? NextResponse.json({ ok: false, error: String(err) }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    reply,
    extractedFields: extractionResult.fields,
    noHouseholdMembers: extractionResult.noHouseholdMembers,
    noIncome: extractionResult.noIncome,
    extractionFailed: extractionResult.extractionFailed ?? false,
  })
}

function buildIntakeHouseholdHintsMessage(message: string): string | null {
  const hints = extractHouseholdRelationshipHints(message)
  if (hints.length === 0) return null
  const lines = hints.map((hint) =>
    hint.memberName
      ? `- Household member provided: ${hint.memberName}; relationship to applicant is ${hint.relationship}.`
      : `- Household relationship already provided: ${hint.relationship}.`,
  )
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
    (normalized.includes("how is") && normalized.includes("related to you")) ||
    (normalized.includes("what is") && normalized.includes("relationship"))
  )
}

function toPossessive(name: string): string {
  return name.toLowerCase().endsWith("s") ? `${name}'` : `${name}'s`
}

function sanitizeIntakeReply(reply: string, latestUserMessage: string): string {
  const hints = extractHouseholdRelationshipHints(latestUserMessage)
  if (hints.length === 0 || !hasRelationshipQuestion(reply)) return reply
  const primaryHint = hints[0]
  if (primaryHint?.memberName) {
    return `Thanks, I have ${primaryHint.memberName} as your ${primaryHint.relationship}. What is ${toPossessive(primaryHint.memberName)} date of birth (MM/DD/YYYY)?`
  }
  return "Thanks, I have that relationship noted. What is this household member's date of birth (MM/DD/YYYY)?"
}

async function handleAssistantOrIntake(
  payload: ValidatedPayload,
  lastUserMessage: ChatMessage,
  language: SupportedLanguage,
  isIntakeMode: boolean,
): Promise<NextResponse> {
  if (!isIntakeMode && !isMassHealthTopic(lastUserMessage.content) && !isMassHealthConversation(payload.messages)) {
    return NextResponse.json({
      ok: true,
      outOfScope: true,
      reply: getMassHealthOutOfScopeResponse(language),
    })
  }

  const intakeHintsMessage = isIntakeMode
    ? buildIntakeHouseholdHintsMessage(lastUserMessage.content)
    : null

  let systemPrompt: string
  if (isIntakeMode) {
    systemPrompt = buildMassHealthIntakeSystemPrompt(language, payload.applicationType)
  } else {
    // Single RAG call for assistant mode (P1 — no duplication with form_assistant)
    const ragChunks = await retrieveRelevantChunks(lastUserMessage.content, RAG_TOP_K).catch(() => [])
    const ragContext = formatChunksForPrompt(ragChunks)
    systemPrompt = ragContext
      ? buildMassHealthSystemPromptWithContext(language, ragContext)
      : buildMassHealthSystemPrompt(language)
  }

  let reply: string
  try {
    reply = await callOllama({
      model: getModel(),
      temperature: OLLAMA_TEMPERATURE,
      timeoutMs: OLLAMA_TIMEOUT_MS,
      systemPrompt,
      extraSystemMessages: intakeHintsMessage ? [intakeHintsMessage] : [],
      messages: buildOllamaMessages(payload.messages),
    })
  } catch (err) {
    return ollamaErrorResponse(err) ?? NextResponse.json({ ok: false, error: String(err) }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    outOfScope: false,
    reply: isIntakeMode ? sanitizeIntakeReply(reply, lastUserMessage.content) : reply,
  })
}

// ── Route entry point ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json()
    const payload = requestSchema.parse(body)
    const language = resolveLanguage(payload.language)
    const lastUserMessage = getLastUserMessage(payload.messages)

    if (!lastUserMessage) {
      return NextResponse.json({ ok: false, error: "At least one user message is required." }, { status: 400 })
    }

    const mode = payload.mode

    if (mode === CHAT_REQUEST_MODE_BENEFIT_ADVISOR) {
      return handleBenefitAdvisor(payload, lastUserMessage, language)
    }

    if (mode === CHAT_REQUEST_MODE_FORM_ASSISTANT) {
      return handleFormAssistant(payload, lastUserMessage, language)
    }

    const isIntakeMode = mode === CHAT_REQUEST_MODE_APPLICATION_INTAKE
    return handleAssistantOrIntake(payload, lastUserMessage, language, isIntakeMode)
  } catch (error) {
    logServerError(ERROR_LOG_PREFIX, error, {
      route: "/api/chat/masshealth",
      method: "POST",
    })
    const isValidationError = error instanceof z.ZodError
    return NextResponse.json(
      { ok: false, error: isValidationError ? ERROR_INVALID_REQUEST_PAYLOAD : ERROR_CHAT_REQUEST_FAILED },
      { status: isValidationError ? 400 : 500 },
    )
  }
}
