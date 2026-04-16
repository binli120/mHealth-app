/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import { embedText, toVectorLiteral } from "./embed"
import {
  RAG_CHUNK_CONTENT_MAX_LEN,
  RAG_DEFAULT_TOP_K,
  RAG_MIN_SCORE,
  RAG_LATENCY_WARN_MS,
} from "./constants"
import type { PolicyChunk } from "./types"
import { incrementCounter } from "@/lib/server/counters"

export type { PolicyChunk }

/**
 * Retrieve the top-K most semantically relevant policy chunks for a query.
 *
 * Improvements over naive top-K:
 *   1. Score threshold — chunks below RAG_MIN_SCORE are filtered at the DB
 *      level so the LLM never receives irrelevant content.
 *   2. Per-document deduplication — only the best-scoring chunk from each
 *      source document is kept, eliminating redundant adjacent chunks that
 *      share content due to the overlap window.  We fetch topK*2 from DB
 *      first to ensure enough diversity survives the dedup pass.
 *   3. Latency counter — fires when the full round-trip (embed + query) exceeds
 *      RAG_LATENCY_WARN_MS so infra regressions surface in dashboards.
 *
 * Returns [] silently if the DB is unavailable (graceful degradation).
 */
export async function retrieveRelevantChunks(
  query: string,
  topK = RAG_DEFAULT_TOP_K,
): Promise<PolicyChunk[]> {
  if (!query.trim()) return []

  try {
    const t0 = Date.now()

    const embedding = await embedText(query)
    const vectorLiteral = toVectorLiteral(embedding)

    // Fetch topK*2 rows so there is enough headroom after per-document dedup
    // while still honouring the score threshold enforced in the WHERE clause.
    const fetchK = Math.min(topK * 2, 20)

    const db = getDbPool()
    const result = await db.query<{
      id: string
      document_id: string
      chunk_index: number
      content: string
      score: number
      document_title: string
      source_url: string | null
      doc_type: string | null
    }>(
      `SELECT
         pc.id,
         pc.document_id,
         pc.chunk_index,
         pc.content,
         1 - (pc.embedding <=> $1::vector) AS score,
         pd.title AS document_title,
         pd.source_url,
         pd.doc_type
       FROM policy_chunks pc
       JOIN policy_documents pd ON pd.id = pc.document_id
       WHERE pc.embedding IS NOT NULL
         AND 1 - (pc.embedding <=> $1::vector) >= $3
       ORDER BY pc.embedding <=> $1::vector
       LIMIT $2`,
      [vectorLiteral, fetchK, RAG_MIN_SCORE],
    )

    // ── Latency check ──────────────────────────────────────────────────────────
    const elapsedMs = Date.now() - t0
    if (elapsedMs > RAG_LATENCY_WARN_MS) {
      incrementCounter("rag_retrieval_latency_exceeded", { thresholdMs: String(RAG_LATENCY_WARN_MS) })
    }

    // ── Per-document deduplication ─────────────────────────────────────────────
    // pgvector returns rows ordered by ascending distance (best first).
    // Iterating in that order ensures we keep the highest-scoring chunk per doc.
    const seenDocuments = new Set<string>()
    const chunks = result.rows
      .map((row) => ({
        id: row.id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        score: parseFloat(String(row.score)),
        documentTitle: row.document_title,
        sourceUrl: row.source_url ?? undefined,
        docType: row.doc_type ?? undefined,
      }))
      .filter((chunk) => {
        if (seenDocuments.has(chunk.documentId)) return false
        seenDocuments.add(chunk.documentId)
        return true
      })
      .slice(0, topK)

    if (chunks.length === 0) {
      incrementCounter("rag_empty_result", { reason: "no_match" })
    }

    return chunks
  } catch {
    // Graceful degradation — if RAG is unavailable, chat still works with static prompts
    incrementCounter("rag_empty_result", { reason: "error" })
    return []
  }
}

/**
 * Format retrieved chunks as a numbered reference block for inclusion in
 * an LLM system prompt.
 *
 * Example output:
 * [1] MassHealth Member Booklet: "Adults with income at or below 138% FPL..."
 * [2] MassHealth Eligibility — Under 65: "CarePlus covers adults aged 19–64..."
 */
export function formatChunksForPrompt(chunks: PolicyChunk[]): string {
  if (chunks.length === 0) return ""

  const lines = chunks.map((chunk, i) => {
    const source = chunk.documentTitle ?? "MassHealth Policy"
    // Trim whitespace and cap length for prompt efficiency
    const content = chunk.content.replace(/\s+/g, " ").trim().slice(0, RAG_CHUNK_CONTENT_MAX_LEN)
    return `[${i + 1}] ${source}: "${content}"`
  })

  return lines.join("\n\n")
}
