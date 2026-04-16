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
import { incrementCounter } from "@/lib/server/counters"
import { logServerInfo } from "@/lib/server/logger"

/** Facts older than this threshold are flagged as stale (env: MEMORY_STALE_DAYS, default 90). */
const MEMORY_STALE_MS = parseInt(process.env.MEMORY_STALE_DAYS ?? "90", 10) * 24 * 60 * 60 * 1000

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

  if (rows[0]) {
    const memory = rowToMemory(rows[0])
    incrementCounter("memory_hit")

    // Warn when stored facts haven't been refreshed within the staleness window.
    // Stale facts (e.g. income from 6 months ago) are still returned — the agent
    // should re-confirm them — but the counter surfaces the pattern in dashboards.
    const factCount = Object.keys(memory.extractedFacts).length
    const ageMs = Date.now() - memory.updatedAt.getTime()
    if (factCount > 0 && ageMs > MEMORY_STALE_MS) {
      incrementCounter("memory_stale")
      logServerInfo("memory.stale_facts_recalled", {
        userId: memory.userId,
        factCount,
        agedays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
      })
    }

    return memory
  }

  return null
}
