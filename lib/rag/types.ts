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
  sourceUrl?: string
  docType?: string
}

export type RagSourceTier = "official" | "legal_aid" | "community" | "unknown"
export type RagConfidence = "none" | "low" | "medium" | "high"

export interface RagSourceMetadata {
  chunkId: string
  documentId: string
  chunkIndex: number
  title: string
  url?: string
  sourceType?: string
  sourceTier: RagSourceTier
  score: number | null
}

export interface RagQualityMetadata {
  query: string
  requestedTopK: number
  returnedChunkCount: number
  confidence: RagConfidence
  maxScore: number | null
  averageScore: number | null
  citationCoverage: {
    citedChunkCount: number
    coverageRatio: number
    hasCitations: boolean
  }
  sources: RagSourceMetadata[]
}
