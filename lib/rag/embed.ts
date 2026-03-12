import "server-only"

// RAG Embedding Client — Ollama nomic-embed-text (768-dim)
// Requires: ollama pull nomic-embed-text

import {
  DEFAULT_OLLAMA_BASE_URL,
  EMBED_MODEL,
  EMBED_TIMEOUT_MS,
  OLLAMA_EMBED_ENDPOINT,
} from "./constants"
import type { OllamaEmbedResponse } from "./types"

function getOllamaBaseUrl(): string {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL
  return baseUrl.replace(/\/+$/, "")
}

/**
 * Generate a 768-dimensional embedding for a single text string using
 * Ollama's nomic-embed-text model (fully local, no external API calls).
 */
export async function embedText(text: string): Promise<number[]> {
  const url = `${getOllamaBaseUrl()}${OLLAMA_EMBED_ENDPOINT}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Ollama embedding failed (${response.status}): ${detail}`)
  }

  const data = (await response.json()) as OllamaEmbedResponse

  if (!data.embedding || data.embedding.length === 0) {
    throw new Error("Ollama returned an empty embedding vector")
  }

  return data.embedding
}

/**
 * Generate embeddings for multiple texts sequentially with a small delay
 * to avoid overwhelming the local Ollama server.
 */
export async function embedBatch(texts: string[], delayMs = 50): Promise<number[][]> {
  const embeddings: number[][] = []

  for (const text of texts) {
    const embedding = await embedText(text)
    embeddings.push(embedding)

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return embeddings
}

/**
 * Format a float array as a pgvector-compatible literal string.
 * e.g. [0.1, 0.2, 0.3] → '[0.1,0.2,0.3]'
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}
