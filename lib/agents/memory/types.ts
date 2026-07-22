/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Shared types for the agent memory layer (Phase 4).
 */

import type { ScreenerData } from "@/lib/eligibility-engine"

// ── Public domain types ───────────────────────────────────────────────────────

export interface AgentMemory {
  id: string
  userId: string
  sessionId: string | null
  extractedFacts: Partial<ScreenerData>
  formProgress: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  /** True when extractedFacts are older than MEMORY_STALE_DAYS (default 90). */
  isStale: boolean
  /** Age of the stored facts in whole days, for prompt-level messaging. */
  factAgeDays: number
}

export interface MemoryUpdatePayload {
  /** Eligibility facts to merge into the existing row. */
  extractedFacts?: Partial<ScreenerData>
  /** Form section progress to merge into the existing row. */
  formProgress?: Record<string, unknown>
  /** Update the session id (ignored when null/undefined). */
  sessionId?: string
}

// ── Internal DB row shape ─────────────────────────────────────────────────────

/** Raw column names returned by `pg` queries on `user_agent_memory`. */
export interface MemoryRow {
  id: string
  user_id: string
  session_id: string | null
  /** Deprecated plaintext column — read-only fallback for pre-encryption rows. */
  extracted_facts: Record<string, unknown> | null
  /** AES-256-GCM ciphertext of the JSON-stringified facts payload. */
  extracted_facts_encrypted: string | null
  form_progress: Record<string, unknown>
  created_at: Date
  updated_at: Date
}
