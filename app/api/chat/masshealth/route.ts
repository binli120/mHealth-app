import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

import {
  buildMassHealthIntakeSystemPrompt,
  buildMassHealthSystemPrompt,
  getMassHealthOutOfScopeResponse,
  isMassHealthTopic,
  type ChatMessage,
} from "@/lib/masshealth/chat-knowledge"
import { extractHouseholdRelationshipHints } from "@/lib/masshealth/household-relationships"
import { logServerError } from "@/lib/server/logger"
import { isSupportedLanguage, type SupportedLanguage } from "@/lib/i18n/languages"
import {
  CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  CHAT_MESSAGE_CONTENT_MIN_LENGTH,
  CHAT_MESSAGE_ROLE_USER,
  CHAT_MESSAGE_ROLES,
  CHAT_REQUEST_MODE_APPLICATION_INTAKE,
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
  MASSHEALTH_CONVERSATION_RECENT_USER_MESSAGES,
  OLLAMA_CHAT_ENDPOINT,
  OLLAMA_MESSAGES_CONTEXT_LIMIT,
  OLLAMA_TEMPERATURE,
  OLLAMA_TIMEOUT_MS,
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
            content: isIntakeMode
              ? buildMassHealthIntakeSystemPrompt(language, payload.applicationType)
              : buildMassHealthSystemPrompt(language),
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
