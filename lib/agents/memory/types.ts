/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
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
  extracted_facts: Record<string, unknown>
  form_progress: Record<string, unknown>
  created_at: Date
  updated_at: Date
}
