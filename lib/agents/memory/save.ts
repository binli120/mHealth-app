/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * mergeAndSaveAgentMemory — upsert agent memory, merging new facts with
 * previously persisted ones.
 *
 * extracted_facts is PHI (age, income, citizenship status, disability,
 * pregnancy, Medicare, employer insurance — see HIPAA_COMPLIANCE.md's PHI
 * inventory) and is stored as AES-256-GCM ciphertext, not plaintext jsonb.
 * Ciphertext can't be merged in SQL, so the merge happens in this function:
 * read the existing row, decrypt, merge in JS, re-encrypt, write the whole
 * blob back inside a transaction (SELECT ... FOR UPDATE guards the
 * read-modify-write against concurrent tool calls for the same user).
 *
 * form_progress has no PHI writers today (dead column, kept for a future
 * use) so it still merges via `jsonb ||`.
 *
 * Null/undefined values are stripped before the merge to avoid replacing
 * good data with empty placeholders.
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import { encryptField, decryptField } from "@/lib/user-profile/encrypt"
import { logPhiAccess } from "@/lib/db/phi-audit"
import { logServerError } from "@/lib/server/logger"
import type { MemoryUpdatePayload } from "./types"

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Remove keys whose value is null or undefined so the merge never
 * overwrites a known fact with an empty placeholder.
 */
function compactObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  )
}

function decryptExistingFacts(
  userId: string,
  encrypted: string | null,
  legacyPlaintext: Record<string, unknown> | null,
): Record<string, unknown> {
  if (encrypted) {
    try {
      return JSON.parse(decryptField(encrypted)) as Record<string, unknown>
    } catch (err) {
      logServerError("memory.decrypt_failed", err, { userId })
      return {}
    }
  }
  return legacyPlaintext ?? {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upsert the agent memory row for `userId`, merging the supplied payload
 * with any existing facts.
 *
 * - `extracted_facts_encrypted` is merged in application code (decrypt →
 *   merge → re-encrypt) since ciphertext can't be merged in SQL. This also
 *   migrates any pre-encryption row (legacy plaintext `extracted_facts`) to
 *   the encrypted column on its next write and clears the plaintext copy.
 * - `form_progress` is merged with `jsonb ||` — new keys added, existing
 *   keys updated, missing keys preserved.
 * - `session_id` is updated only when explicitly provided (COALESCE guard).
 */
export async function mergeAndSaveAgentMemory(
  userId: string,
  payload: MemoryUpdatePayload,
): Promise<void> {
  const pool = getDbPool()

  const newFacts = compactObject(
    (payload.extractedFacts ?? {}) as Record<string, unknown>,
  )
  const progress = compactObject(
    (payload.formProgress ?? {}) as Record<string, unknown>,
  )

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const { rows } = await client.query<{
      extracted_facts: Record<string, unknown> | null
      extracted_facts_encrypted: string | null
    }>(
      `SELECT extracted_facts, extracted_facts_encrypted
         FROM public.user_agent_memory
        WHERE user_id = $1
        FOR UPDATE`,
      [userId],
    )

    const existingFacts = decryptExistingFacts(
      userId,
      rows[0]?.extracted_facts_encrypted ?? null,
      rows[0]?.extracted_facts ?? null,
    )
    const mergedFacts = { ...existingFacts, ...newFacts }
    const encryptedFacts = encryptField(JSON.stringify(mergedFacts))

    await client.query(
      `INSERT INTO public.user_agent_memory
            (user_id, session_id, extracted_facts_encrypted, form_progress)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         session_id                = COALESCE($2, public.user_agent_memory.session_id),
         extracted_facts_encrypted = $3,
         extracted_facts           = NULL,
         form_progress             = public.user_agent_memory.form_progress || $4::jsonb,
         updated_at                = now()`,
      [userId, payload.sessionId ?? null, encryptedFacts, JSON.stringify(progress)],
    )

    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }

  if (Object.keys(newFacts).length > 0) {
    logPhiAccess(userId, "phi.agent_memory.written", {}, { factKeys: Object.keys(newFacts) })
  }
}
