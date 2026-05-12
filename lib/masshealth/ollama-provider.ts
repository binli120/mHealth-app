/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { createOpenAI } from "@ai-sdk/openai"
import { createGroq } from "@ai-sdk/groq"
import { wrapLanguageModel } from "ai"
import type { LanguageModelMiddleware } from "ai"


/**
 * Returns an AI SDK model routed to Groq (if GROQ_API_KEY is set) with
 * automatic fallback to local Ollama on rate-limit errors (429).
 * Call at request time so env vars are read fresh on each invocation.
 */
export function getOllamaModel(modelName?: string) {
  const ollamaBaseURL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "")
  const ollamaProvider = createOpenAI({ baseURL: `${ollamaBaseURL}/v1`, apiKey: "ollama" })
  const ollamaModel = ollamaProvider(process.env.OLLAMA_MODEL ?? "llama3.2:1b")

  if (!process.env.GROQ_API_KEY) {
    return ollamaModel
  }

  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
  const groqModel = groq(modelName ?? process.env.GROQ_MODEL ?? "llama-3.1-8b-instant")

  const fallbackMiddleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate()
      } catch {
        return ollamaModel.doGenerate(params)
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream()
      } catch {
        return ollamaModel.doStream(params)
      }
    },
  }

  return wrapLanguageModel({ model: groqModel, middleware: fallbackMiddleware })
}
