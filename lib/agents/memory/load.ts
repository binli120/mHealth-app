/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * loadUserAgentMemory — fetch the persisted memory row for a user.
 *
 * Returns null when the user has no memory yet (first session).
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import type { ScreenerData } from "@/lib/eligibility-engine"
import type { AgentMemory, MemoryRow } from "./types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToMemory(row: MemoryRow): AgentMemory {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    extractedFacts: (row.extracted_facts ?? {}) as Partial<ScreenerData>,
    formProgress: row.form_progress ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the persisted agent memory for a given user.
 *
 * @returns The memory object, or `null` if this user has no prior session.
 */
export async function loadUserAgentMemory(userId: string): Promise<AgentMemory | null> {
  const pool = getDbPool()

  const { rows } = await pool.query<MemoryRow>(
    `SELECT id, user_id, session_id, extracted_facts, form_progress, created_at, updated_at
       FROM user_agent_memory
      WHERE user_id = $1
      LIMIT 1`,
    [userId],
  )

  return rows[0] ? rowToMemory(rows[0]) : null
}
