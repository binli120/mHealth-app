/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { createOpenAI } from "@ai-sdk/openai"

/**
 * Returns an AI SDK model routed to Groq (if GROQ_API_KEY is set) or the
 * local Ollama instance as fallback. Call at request time so env vars are
 * read fresh on each invocation.
 */
export function getOllamaModel(modelName?: string) {
  if (process.env.GROQ_API_KEY) {
    const groq = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    })
    return groq(modelName ?? process.env.GROQ_MODEL ?? "llama-3.1-8b-instant")
  }

  const baseURL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "")
  const provider = createOpenAI({ baseURL: `${baseURL}/v1`, apiKey: "ollama" })
  return provider(modelName ?? process.env.OLLAMA_MODEL ?? "llama3.2:1b")
}
