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
 * blob back.
 *
 * First-session race: `SELECT ... FOR UPDATE` locks nothing when no row
 * exists yet, so two concurrent first-time writes for the same brand-new
 * user would both read an empty row, both merge against `{}`, and whichever
 * commits second would overwrite the winner's facts via `ON CONFLICT DO
 * UPDATE` (its merge never saw the winner's insert). To avoid that:
 *   1. `INSERT ... ON CONFLICT (user_id) DO NOTHING` — guarantees a row
 *      exists. Postgres serializes concurrent inserts on the same
 *      conflicting key at this step (the second inserter blocks until the
 *      first commits/rolls back), so this is also where the race gets
 *      resolved, not just where the row gets created.
 *   2. `SELECT ... FOR UPDATE` — now always locks a real, existing row.
 *   3. Decrypt + merge in JS, then a plain `UPDATE` (not an upsert) writes
 *      the merged result back while still holding the lock from step 2.
 *
 * form_progress has no PHI writers today (dead column, kept for a future
 * use) so it still merges via `jsonb ||` in the final UPDATE — safe there
 * because the row lock from step 2 is still held.
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

/**
 * Thrown when an existing encrypted row can't be decrypted (bad key, key
 * rotation misconfiguration, corrupt read). Deliberately NOT caught by
 * treating it as "no prior facts" — doing so would let the merge below
 * re-encrypt only the new facts and the UPDATE would permanently overwrite
 * the old ciphertext, discarding otherwise-recoverable prior facts the
 * moment the underlying key/config issue is fixed. Callers should let the
 * write fail (transaction rolls back, old row is untouched) rather than
 * lose data.
 */
export class MemoryDecryptError extends Error {
  constructor(userId: string, cause: unknown) {
    super(`Failed to decrypt existing agent memory for user ${userId}`)
    this.name = "MemoryDecryptError"
    this.cause = cause
  }
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
      throw new MemoryDecryptError(userId, err)
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
 * - See the insert/lock/re-read note above the imports for why this is
 *   three statements (insert-if-missing, lock, update) instead of one
 *   `INSERT ... ON CONFLICT DO UPDATE`.
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

    // Guarantee a row exists before locking it. Concurrent first-writes for
    // the same brand-new user serialize here: Postgres blocks the second
    // inserter on the unique `user_id` index until the first commits, so by
    // the time either transaction reaches the SELECT below, the row is
    // real and visible.
    await client.query(
      `INSERT INTO public.user_agent_memory (user_id, session_id, extracted_facts_encrypted, form_progress)
       VALUES ($1, $2, NULL, '{}'::jsonb)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, payload.sessionId ?? null],
    )

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
      `UPDATE public.user_agent_memory SET
         session_id                = COALESCE($2, session_id),
         extracted_facts_encrypted = $3,
         extracted_facts           = NULL,
         form_progress             = form_progress || $4::jsonb,
         updated_at                = now()
       WHERE user_id = $1`,
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
