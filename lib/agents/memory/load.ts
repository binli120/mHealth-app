/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * loadUserAgentMemory — fetch the persisted memory row for a user.
 *
 * Returns null when the user has no memory yet (first session).
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import { decryptField } from "@/lib/user-profile/encrypt"
import { logPhiAccess } from "@/lib/db/phi-audit"
import type { ScreenerData } from "@/lib/eligibility-engine"
import type { AgentMemory, MemoryRow } from "./types"
import { incrementCounter } from "@/lib/server/counters"
import { logServerInfo, logServerError } from "@/lib/server/logger"

/** Facts older than this threshold are flagged as stale (env: MEMORY_STALE_DAYS, default 90). */
const MEMORY_STALE_MS = parseInt(process.env.MEMORY_STALE_DAYS ?? "90", 10) * 24 * 60 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Decrypt the stored facts payload. Prefers the encrypted column; falls back
 * to the deprecated plaintext column for rows written before encryption was
 * added (they self-heal to encrypted on the next mergeAndSaveAgentMemory).
 */
function decryptFacts(row: MemoryRow): Partial<ScreenerData> {
  if (row.extracted_facts_encrypted) {
    try {
      return JSON.parse(decryptField(row.extracted_facts_encrypted)) as Partial<ScreenerData>
    } catch (err) {
      logServerError("memory.decrypt_failed", err, { userId: row.user_id })
      return {}
    }
  }

  if (row.extracted_facts && Object.keys(row.extracted_facts).length > 0) {
    incrementCounter("memory_legacy_plaintext_read")
    return row.extracted_facts as Partial<ScreenerData>
  }

  return {}
}

function rowToMemory(row: MemoryRow): AgentMemory {
  const ageMs = Date.now() - row.updated_at.getTime()
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    extractedFacts: decryptFacts(row),
    formProgress: row.form_progress ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isStale: ageMs > MEMORY_STALE_MS,
    factAgeDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
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
    `SELECT id, user_id, session_id, extracted_facts, extracted_facts_encrypted,
            form_progress, created_at, updated_at
       FROM public.user_agent_memory
      WHERE user_id = $1
      LIMIT 1`,
    [userId],
  )

  if (rows[0]) {
    const memory = rowToMemory(rows[0])
    incrementCounter("memory_hit")

    const factCount = Object.keys(memory.extractedFacts).length
    if (factCount > 0) {
      logPhiAccess(userId, "phi.agent_memory.read", {}, { factCount })
    }

    // Warn when stored facts haven't been refreshed within the staleness window.
    // Stale facts (e.g. income from 6 months ago) are still returned — the agent
    // should re-confirm them (see isStale/factAgeDays on the returned memory) —
    // but the counter surfaces the pattern in dashboards too.
    if (factCount > 0 && memory.isStale) {
      incrementCounter("memory_stale")
      logServerInfo("memory.stale_facts_recalled", {
        userId: memory.userId,
        factCount,
        agedays: memory.factAgeDays,
      })
    }

    return memory
  }

  return null
}
