/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * RAG quality metadata for agent annotations and tool results.
 */

import type {
  PolicyChunk,
  RagConfidence,
  RagQualityMetadata,
  RagSourceTier,
} from "./types"
import {
  RAG_CONFIDENCE_HIGH_MAX,
  RAG_CONFIDENCE_HIGH_AVG,
  RAG_CONFIDENCE_MED_MAX,
  RAG_CONFIDENCE_MED_AVG,
} from "./constants"

function isPolicyChunk(value: unknown): value is PolicyChunk {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "documentId" in value &&
    "chunkIndex" in value
  )
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000
}

function normaliseScore(score: unknown): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null
  return roundScore(Math.max(0, Math.min(1, score)))
}

function inferSourceTier(chunk: PolicyChunk): RagSourceTier {
  const url = chunk.sourceUrl?.toLowerCase() ?? ""
  const title = chunk.documentTitle?.toLowerCase() ?? ""

  if (url.includes("mass.gov") || url.includes("cms.gov") || title.includes("masshealth")) {
    return "official"
  }
  if (url.includes("masslegalhelp.org") || url.includes("legal") || title.includes("legal aid")) {
    return "legal_aid"
  }
  if (url) return "community"
  return "unknown"
}

function confidenceFromScores(returnedChunkCount: number, maxScore: number | null, averageScore: number | null): RagConfidence {
  if (returnedChunkCount === 0 || maxScore === null || averageScore === null) return "none"
  if (maxScore >= RAG_CONFIDENCE_HIGH_MAX && averageScore >= RAG_CONFIDENCE_HIGH_AVG) return "high"
  if (maxScore >= RAG_CONFIDENCE_MED_MAX  && averageScore >= RAG_CONFIDENCE_MED_AVG)  return "medium"
  return "low"
}

export function buildRagQualityMetadata(
  query: string,
  chunks: unknown[],
  requestedTopK: number,
): RagQualityMetadata {
  const policyChunks = chunks.filter(isPolicyChunk)
  const scores = policyChunks
    .map((chunk) => normaliseScore(chunk.score))
    .filter((score): score is number => score !== null)

  const maxScore = scores.length > 0 ? roundScore(Math.max(...scores)) : null
  const averageScore = scores.length > 0
    ? roundScore(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : null

  const sources = policyChunks.map((chunk) => ({
    chunkId: chunk.id,
    documentId: chunk.documentId,
    chunkIndex: chunk.chunkIndex,
    title: chunk.documentTitle ?? "MassHealth Policy",
    url: chunk.sourceUrl,
    sourceType: chunk.docType,
    sourceTier: inferSourceTier(chunk),
    score: normaliseScore(chunk.score),
  }))

  const citedChunkCount = sources.filter((source) => source.title || source.url).length
  const returnedChunkCount = policyChunks.length

  return {
    query,
    requestedTopK,
    returnedChunkCount,
    confidence: confidenceFromScores(returnedChunkCount, maxScore, averageScore),
    maxScore,
    averageScore,
    citationCoverage: {
      citedChunkCount,
      coverageRatio: returnedChunkCount > 0 ? roundScore(citedChunkCount / returnedChunkCount) : 0,
      hasCitations: citedChunkCount > 0,
    },
    sources,
  }
}
