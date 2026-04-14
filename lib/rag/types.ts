/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

/**
 * Shared type definitions for the RAG (Retrieval-Augmented Generation) module.
 */

// ── Ollama API ─────────────────────────────────────────────────────────────────

/** Raw response shape from Ollama /api/embeddings endpoint. */
export interface OllamaEmbedResponse {
  embedding?: number[]
}

// ── Document ingestion ────────────────────────────────────────────────────────

/** A policy document source to be fetched, chunked, and embedded. */
export interface DocumentSource {
  title: string
  url: string
  doc_type: "member_booklet" | "eligibility_guide" | "verifications" | "transmittal" | "faq"
  language: string
}

/** Result returned after ingesting one document. */
export interface IngestResult {
  title: string
  url: string
  chunkCount: number
  skipped?: boolean
  error?: string
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

/** A single retrieved policy chunk with its cosine similarity score. */
export interface PolicyChunk {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  /** Cosine similarity score in range [0, 1]. Higher = more relevant. */
  score: number
  documentTitle?: string
}
