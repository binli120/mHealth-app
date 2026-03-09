import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"

import {
  buildMassHealthSystemPrompt,
  getMassHealthOutOfScopeResponse,
  isMassHealthTopic,
  type ChatMessage,
} from "@/lib/masshealth/chat-knowledge"
import { isSupportedLanguage, type SupportedLanguage } from "@/lib/i18n/languages"
import {
  CHAT_MESSAGE_CONTENT_MAX_LENGTH,
  CHAT_MESSAGE_CONTENT_MIN_LENGTH,
  CHAT_MESSAGE_ROLE_USER,
  CHAT_MESSAGE_ROLES,
  CHAT_REQUEST_MAX_MESSAGES,
  CHAT_REQUEST_MIN_MESSAGES,
  CHAT_RUNTIME,
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

export const runtime = CHAT_RUNTIME

const chatMessageSchema = z.object({
  role: z.enum(CHAT_MESSAGE_ROLES),
  content: z.string().trim().min(CHAT_MESSAGE_CONTENT_MIN_LENGTH).max(CHAT_MESSAGE_CONTENT_MAX_LENGTH),
})

const requestSchema = z.object({
  messages: z.array(chatMessageSchema).min(CHAT_REQUEST_MIN_MESSAGES).max(CHAT_REQUEST_MAX_MESSAGES),
  language: z.string().optional(),
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

    if (!lastUserMessage) {
      return NextResponse.json(
        {
          ok: false,
          error: ERROR_USER_MESSAGE_REQUIRED,
        },
        { status: 400 },
      )
    }

    if (!isMassHealthTopic(lastUserMessage.content) && !isMassHealthConversation(payload.messages)) {
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
            content: buildMassHealthSystemPrompt(language),
          },
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
      reply,
    })
  } catch (error) {
    console.error(ERROR_LOG_PREFIX, error)

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
