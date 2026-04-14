/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import { embedText, toVectorLiteral } from "./embed"
import { RAG_CHUNK_CONTENT_MAX_LEN } from "./constants"
import type { PolicyChunk } from "./types"

export type { PolicyChunk }

/**
 * Retrieve the top-K most semantically relevant policy chunks for a query.
 * Uses pgvector cosine similarity search.
 * Returns [] silently if the DB is unavailable or no chunks exist yet.
 */
export async function retrieveRelevantChunks(
  query: string,
  topK = 4,
): Promise<PolicyChunk[]> {
  if (!query.trim()) return []

  try {
    const embedding = await embedText(query)
    const vectorLiteral = toVectorLiteral(embedding)

    const db = getDbPool()
    const result = await db.query<{
      id: string
      document_id: string
      chunk_index: number
      content: string
      score: number
      document_title: string
    }>(
      `SELECT
         pc.id,
         pc.document_id,
         pc.chunk_index,
         pc.content,
         1 - (pc.embedding <=> $1::vector) AS score,
         pd.title AS document_title
       FROM policy_chunks pc
       JOIN policy_documents pd ON pd.id = pc.document_id
       WHERE pc.embedding IS NOT NULL
       ORDER BY pc.embedding <=> $1::vector
       LIMIT $2`,
      [vectorLiteral, topK],
    )

    return result.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      content: row.content,
      score: parseFloat(String(row.score)),
      documentTitle: row.document_title,
    }))
  } catch {
    // Graceful degradation — if RAG is unavailable, chat still works with static prompts
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
