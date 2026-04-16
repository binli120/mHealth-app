/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Lightweight observability counters backed by the existing logger/OpenObserve
 * pipeline.  Each increment emits a structured `metric.counter` log event that
 * OpenObserve (and any compatible log-analytics backend) can aggregate with a
 * simple `WHERE metric = true AND counter = '...'` query.
 *
 * Usage:
 *   incrementCounter("rag_empty_result", { reason: "no_match" })
 *
 * All counters are fire-and-forget — they never throw and never block the
 * response path.
 */

import "server-only"

import { logServerInfo } from "./logger"

// ── Counter registry ──────────────────────────────────────────────────────────

export type CounterName =
  /** One increment per individual tool call; label: { agent, tool } */
  | "tool_call"
  /** One increment per completed agent turn; label: { agent, sequence } */
  | "tool_call_sequence"
  /** Reflection quality gate produced a revised draft; label: { type, issueCount } */
  | "reflection_revision"
  /** Reflection quality gate was unavailable (fell back); label: { type } */
  | "reflection_gate_unavailable"
  /** loadUserAgentMemory returned a non-null row (prior-session hit) */
  | "memory_hit"
  /** Recalled memory facts are older than the configured staleness threshold */
  | "memory_stale"
  /** retrieveRelevantChunks returned []; label: { reason: "no_match"|"error" } */
  | "rag_empty_result"
  /** Ollama /api/embeddings call failed (HTTP error or empty vector) */
  | "rag_embedding_error"
  /** Full retrieval round-trip exceeded the latency warning threshold; label: { thresholdMs } */
  | "rag_retrieval_latency_exceeded"
  /** LLM answer generated with absent or low-confidence policy grounding; label: { agent } */
  | "rag_low_confidence_used"
  /** LLM output could not be parsed into structured data; label: { extractor, reason } */
  | "extraction_parse_failure"

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Increment a named counter by 1.
 *
 * @param name   - One of the registered CounterName values.
 * @param labels - Optional key/value dimensions for slicing the counter in your
 *                 observability backend (e.g. `{ agent: "appeal", tool: "retrieve_policy" }`).
 */
export function incrementCounter(
  name: CounterName,
  labels?: Record<string, string>,
): void {
  logServerInfo("metric.counter", {
    metric: true,
    counter: name,
    value: 1,
    ...(labels ?? {}),
  })
}
