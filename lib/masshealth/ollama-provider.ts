/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { createOpenAI } from "@ai-sdk/openai"

/**
 * Returns an AI SDK LanguageModelV1 that routes to the local Ollama instance
 * via its OpenAI-compatible endpoint (/v1/chat/completions).
 *
 * Call this at request time (not module-load time) so env vars are read fresh
 * on each request — important for Next.js serverless environments.
 */
export function getOllamaModel(modelName?: string) {
  const baseURL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434")
    .replace(/\/+$/, "")

  const provider = createOpenAI({
    baseURL: `${baseURL}/v1`,
    // Ollama requires the field but ignores the value
    apiKey: "ollama",
  })

  return provider(modelName ?? process.env.OLLAMA_MODEL ?? "llama3.2")
}
