/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * mergeAndSaveAgentMemory — upsert agent memory, merging new facts with
 * previously persisted ones.
 *
 * Uses Postgres `jsonb ||` to deep-merge at the top level so that only
 * newly-extracted keys overwrite old values; previously known facts
 * (e.g., age from turn 2) survive into turn 10 unchanged.
 *
 * Null/undefined values are stripped before the merge to avoid replacing
 * good data with empty placeholders.
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import type { MemoryUpdatePayload } from "./types"

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Remove keys whose value is null or undefined so the jsonb merge never
 * overwrites a known fact with an empty placeholder.
 */
function compactObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upsert the agent memory row for `userId`, merging the supplied payload
 * with any existing facts.
 *
 * - `extracted_facts` and `form_progress` are merged with `jsonb ||` —
 *   new keys are added, existing keys updated, missing keys preserved.
 * - `session_id` is updated only when explicitly provided (COALESCE guard).
 */
export async function mergeAndSaveAgentMemory(
  userId: string,
  payload: MemoryUpdatePayload,
): Promise<void> {
  const pool = getDbPool()

  const facts = compactObject(
    (payload.extractedFacts ?? {}) as Record<string, unknown>,
  )
  const progress = compactObject(
    (payload.formProgress ?? {}) as Record<string, unknown>,
  )

  await pool.query(
    `INSERT INTO user_agent_memory (user_id, session_id, extracted_facts, form_progress)
          VALUES ($1, $2, $3::jsonb, $4::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET
       session_id      = COALESCE($2, user_agent_memory.session_id),
       extracted_facts = user_agent_memory.extracted_facts || $3::jsonb,
       form_progress   = user_agent_memory.form_progress   || $4::jsonb,
       updated_at      = now()`,
    [
      userId,
      payload.sessionId ?? null,
      JSON.stringify(facts),
      JSON.stringify(progress),
    ],
  )
}
