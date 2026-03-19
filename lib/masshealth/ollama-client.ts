import "server-only"

import { DEFAULT_OLLAMA_BASE_URL, OLLAMA_CHAT_ENDPOINT } from "@/lib/rag/constants"
import type { ChatMessage } from "./types"

export interface OllamaCallOptions {
  model: string
  temperature: number
  timeoutMs: number
  /** System prompt injected before the message list. */
  systemPrompt: string
  /** Additional system messages inserted after the main system prompt (e.g. hints). */
  extraSystemMessages?: string[]
  messages: ChatMessage[]
  /** Max number of trailing messages to include. Defaults to all. */
  messageWindowSize?: number
}

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "")
}

/**
 * Shared Ollama chat completion call.
 * Returns the trimmed reply string, or throws on HTTP error / empty response.
 */
export async function callOllama(opts: OllamaCallOptions): Promise<string> {
  const {
    model,
    temperature,
    timeoutMs,
    systemPrompt,
    extraSystemMessages = [],
    messages,
    messageWindowSize,
  } = opts

  const trimmedMessages = messageWindowSize != null
    ? messages.slice(-messageWindowSize)
    : messages

  const systemMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...extraSystemMessages.map((content) => ({ role: "system" as const, content })),
  ]

  const response = await fetch(`${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature },
      messages: [...systemMessages, ...trimmedMessages],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new OllamaError(`Ollama request failed: HTTP ${response.status}`, response.status, detail)
  }

  const data = (await response.json()) as { message?: { content?: string } }
  const reply = data.message?.content?.trim()
  if (!reply) throw new OllamaError("Ollama returned an empty response", 502, "")
  return reply
}

export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(message)
    this.name = "OllamaError"
  }
}
