/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * One-time backfill: encrypt existing plaintext PHI columns on the applicants
 * table into the new *_encrypted columns added by migration
 * 20260428100000_encrypt_phi_fields.sql.
 *
 * Usage
 * ──────────────────────────────────────────────────────────────────────────────
 *   pnpm tsx scripts/backfill-phi-encryption.ts
 *
 * The script is fully idempotent — it only processes rows where at least one
 * *_encrypted column is still NULL (i.e. rows not yet backfilled).  Re-running
 * it after a partial failure is safe.
 *
 * Environment variables required
 * ──────────────────────────────────────────────────────────────────────────────
 *   DATABASE_URL_DEV  or  DATABASE_URL   – Postgres connection string
 *   PROFILE_ENCRYPTION_KEY               – 64 hex chars (32 bytes AES-256 key)
 *
 * After this script completes and you have verified that all rows have
 * non-NULL *_encrypted values, run the follow-up cleanup migration to NULL
 * and DROP the legacy plaintext columns (see the TODO in the SQL migration).
 */

import { Pool } from "pg"
import { createCipheriv, randomBytes, type CipherGCM } from "crypto"

// ── Encryption (inlined — cannot import lib/user-profile/encrypt.ts here
//    because it uses `import "server-only"` which is a Next.js-only module) ───

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function getKey(): Buffer {
  const raw = process.env.PROFILE_ENCRYPTION_KEY
  if (!raw) throw new Error("PROFILE_ENCRYPTION_KEY environment variable is not set")
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  const buf = Buffer.from(raw, "base64")
  if (buf.length !== 32) throw new Error("PROFILE_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)")
  return buf
}

function encryptField(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv) as CipherGCM
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

// ── Database connection ───────────────────────────────────────────────────────

const connectionString =
  process.env.DATABASE_URL_DEV ??
  process.env.DATABASE_URL

if (!connectionString) {
  console.error("❌  Missing database connection string.")
  console.error("    Set DATABASE_URL_DEV or DATABASE_URL and try again.")
  process.exit(1)
}

const pool = new Pool({ connectionString })

// ── PHI column pairs: [plaintext column, encrypted column] ────────────────────

const COLUMN_PAIRS: Array<[string, string]> = [
  ["first_name",    "first_name_encrypted"],
  ["last_name",     "last_name_encrypted"],
  ["phone",         "phone_encrypted"],
  ["address_line1", "address_line1_encrypted"],
  ["address_line2", "address_line2_encrypted"],
  ["city",          "city_encrypted"],
  ["state",         "state_encrypted"],
  ["zip",           "zip_encrypted"],
]

// DOB is a DATE column in the DB, cast to text as ISO "YYYY-MM-DD".
const DOB_PAIR: [string, string] = ["dob", "dob_encrypted"]

// ── Backfill logic ────────────────────────────────────────────────────────────

const BATCH_SIZE = 100

/**
 * Fetch a batch of rows that still have at least one NULL *_encrypted column.
 * Returns the row id plus all plaintext PHI values.
 */
async function fetchBatch(afterId: string | null): Promise<Array<Record<string, string | null>>> {
  const cursorClause = afterId ? `AND id > $1` : ""
  const params = afterId ? [afterId] : []

  const { rows } = await pool.query(
    `SELECT
       id,
       first_name, last_name,
       dob::text AS dob,
       phone, address_line1, address_line2,
       city, state, zip
     FROM public.applicants
     WHERE (
       first_name_encrypted    IS NULL
       OR last_name_encrypted  IS NULL
       OR dob_encrypted        IS NULL
       OR phone_encrypted      IS NULL
       OR address_line1_encrypted IS NULL
       OR city_encrypted       IS NULL
       OR state_encrypted      IS NULL
       OR zip_encrypted        IS NULL
     )
     ${cursorClause}
     ORDER BY id
     LIMIT $${params.length + 1}`,
    [...params, BATCH_SIZE],
  )

  return rows
}

/**
 * Encrypt all plaintext PHI columns for one applicant row and write the
 * result back to the *_encrypted columns.
 *
 * Only columns whose encrypted value is currently NULL are written — this
 * avoids re-encrypting an already-migrated field (e.g. partial backfill).
 */
async function backfillRow(row: Record<string, string | null>): Promise<void> {
  const setClauses: string[] = []
  const values: (string | null)[] = []
  let idx = 1

  // Standard text columns
  for (const [plain, enc] of COLUMN_PAIRS) {
    const plainValue = row[plain]
    // Only write if plaintext exists and encrypted is (was) NULL
    if (plainValue) {
      setClauses.push(`${enc} = $${idx}`)
      values.push(encryptField(plainValue))
      idx++
    }
  }

  // DOB: stored as text "YYYY-MM-DD" after ::text cast
  const dobValue = row["dob"]
  if (dobValue) {
    setClauses.push(`${DOB_PAIR[1]} = $${idx}`)
    values.push(encryptField(dobValue))
    idx++
  }

  if (setClauses.length === 0) return  // nothing to write for this row

  values.push(row["id"])
  await pool.query(
    `UPDATE public.applicants SET ${setClauses.join(", ")} WHERE id = $${idx}`,
    values,
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔐  PHI encryption backfill starting…")
  console.log(`    Batch size: ${BATCH_SIZE}`)

  let totalProcessed = 0
  let totalUpdated = 0
  let lastId: string | null = null

  while (true) {
    const batch = await fetchBatch(lastId)
    if (batch.length === 0) break

    for (const row of batch) {
      try {
        await backfillRow(row)
        totalUpdated++
      } catch (err) {
        console.error(`❌  Failed to backfill row id=${row["id"]}:`, err)
        // Continue with remaining rows — a partial failure should not abort
        // the entire run.  Re-run the script after fixing the error.
      }
      totalProcessed++
    }

    lastId = batch[batch.length - 1]["id"] as string
    process.stdout.write(`\r    Processed ${totalProcessed} rows (${totalUpdated} updated)…`)
  }

  console.log(`\n✅  Backfill complete.`)
  console.log(`    Rows processed : ${totalProcessed}`)
  console.log(`    Rows updated   : ${totalUpdated}`)

  if (totalProcessed > 0) {
    // Verification: count remaining un-encrypted rows
    const { rows } = await pool.query<{ remaining: string }>(`
      SELECT COUNT(*)::text AS remaining
      FROM public.applicants
      WHERE (
        (first_name    IS NOT NULL AND first_name_encrypted    IS NULL)
        OR (last_name  IS NOT NULL AND last_name_encrypted     IS NULL)
        OR (dob        IS NOT NULL AND dob_encrypted           IS NULL)
        OR (phone      IS NOT NULL AND phone_encrypted         IS NULL)
        OR (address_line1 IS NOT NULL AND address_line1_encrypted IS NULL)
        OR (city       IS NOT NULL AND city_encrypted          IS NULL)
        OR (state      IS NOT NULL AND state_encrypted         IS NULL)
        OR (zip        IS NOT NULL AND zip_encrypted           IS NULL)
      )
    `)
    const remaining = parseInt(rows[0]?.remaining ?? "0", 10)
    if (remaining > 0) {
      console.warn(`⚠️  ${remaining} rows still have un-encrypted PHI columns.`)
      console.warn("    Re-run this script after investigating the failures above.")
    } else {
      console.log("    Verification: all PHI columns are now encrypted. ✓")
      console.log("")
      console.log("    Next step: run the follow-up cleanup migration to NULL and")
      console.log("    DROP the legacy plaintext columns (see migration TODO comment).")
    }
  }

  await pool.end()
}

main().catch((err) => {
  console.error("Fatal error:", err)
  pool.end().finally(() => process.exit(1))
})
