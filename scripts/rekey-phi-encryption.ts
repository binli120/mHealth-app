/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * PHI key-rotation migration: re-encrypts every *_encrypted column on the
 * applicants table from the old AES-256-GCM key (v1: prefix) to a freshly
 * generated key (v2: prefix).
 *
 * The script is fully idempotent — columns already carrying the v2: prefix are
 * skipped, so re-running after a partial failure is safe.
 *
 * ─── Prerequisites ────────────────────────────────────────────────────────────
 *
 *   1. Generate a new 32-byte key:
 *        openssl rand -hex 32
 *
 *   2. Deploy an updated lib/user-profile/encrypt.ts that can decrypt BOTH
 *      v1: (old key via PROFILE_ENCRYPTION_KEY_OLD) and v2: (new key via
 *      PROFILE_ENCRYPTION_KEY) — see docs/PHI_KEY_ROTATION.md for the patch.
 *
 *   3. Set the environment variables below before running this script.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   # Dry-run first (no DB writes):
 *   DRY_RUN=true \
 *   PROFILE_ENCRYPTION_KEY_OLD=<64 hex chars> \
 *   PROFILE_ENCRYPTION_KEY_NEW=<64 hex chars> \
 *   DATABASE_URL=<connection string> \
 *   pnpm tsx scripts/rekey-phi-encryption.ts
 *
 *   # Live run:
 *   PROFILE_ENCRYPTION_KEY_OLD=<64 hex chars> \
 *   PROFILE_ENCRYPTION_KEY_NEW=<64 hex chars> \
 *   DATABASE_URL=<connection string> \
 *   pnpm tsx scripts/rekey-phi-encryption.ts
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 *
 *   PROFILE_ENCRYPTION_KEY_OLD  Required. The key currently in production
 *                               (64 hex chars = 32 bytes).
 *   PROFILE_ENCRYPTION_KEY_NEW  Required. The freshly generated replacement
 *                               (64 hex chars = 32 bytes).
 *   DATABASE_URL                Postgres connection string (falls back to
 *     or DATABASE_URL_DEV       DATABASE_URL_DEV if DATABASE_URL is absent).
 *   DRY_RUN                     Set to "true" to scan without writing.
 *   BATCH_SIZE                  Rows per batch (default: 100).
 */

import { Pool } from "pg"
import { createCipheriv, createDecipheriv, randomBytes, type CipherGCM } from "crypto"

// ─── Inline crypto ────────────────────────────────────────────────────────────
// Cannot import lib/user-profile/encrypt.ts here because it uses
// `import "server-only"` which is a Next.js-only module.

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function parseKey(raw: string | undefined, envName: string): Buffer {
  if (!raw) throw new Error(`Missing required env var: ${envName}`)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  const buf = Buffer.from(raw, "base64")
  if (buf.length !== 32)
    throw new Error(`${envName} must be 32 bytes (64 hex chars or 44 base64 chars)`)
  return buf
}

function decryptFieldWithKey(stored: string, key: Buffer): string {
  const parts = stored.split(":")

  let ivHex: string, tagHex: string, cipherHex: string

  if (parts.length === 4 && (parts[0] === "v1" || parts[0] === "v2")) {
    ;[, ivHex, tagHex, cipherHex] = parts as [string, string, string, string]
  } else if (parts.length === 3) {
    // Legacy unversioned format (iv:tag:cipher)
    ;[ivHex, tagHex, cipherHex] = parts as [string, string, string]
  } else {
    throw new Error(`Invalid encrypted field format: ${stored.slice(0, 20)}…`)
  }

  const iv = Buffer.from(ivHex!, "hex")
  const tag = Buffer.from(tagHex!, "hex")
  const ciphertext = Buffer.from(cipherHex!, "hex")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

function encryptFieldWithKey(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv) as CipherGCM
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v2", iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

// ─── Configuration ────────────────────────────────────────────────────────────

const OLD_KEY = parseKey(process.env.PROFILE_ENCRYPTION_KEY_OLD, "PROFILE_ENCRYPTION_KEY_OLD")
const NEW_KEY = parseKey(process.env.PROFILE_ENCRYPTION_KEY_NEW, "PROFILE_ENCRYPTION_KEY_NEW")
const DRY_RUN = process.env.DRY_RUN === "true"
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "100", 10)

const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV
if (!connectionString) {
  console.error("❌  Missing database connection string.")
  console.error("    Set DATABASE_URL or DATABASE_URL_DEV and try again.")
  process.exit(1)
}

const pool = new Pool({ connectionString })

// ─── Column definitions ───────────────────────────────────────────────────────

const ENCRYPTED_COLUMNS = [
  "first_name_encrypted",
  "last_name_encrypted",
  "dob_encrypted",
  "phone_encrypted",
  "address_line1_encrypted",
  "address_line2_encrypted",
  "city_encrypted",
  "state_encrypted",
  "zip_encrypted",
] as const

type EncryptedColumn = (typeof ENCRYPTED_COLUMNS)[number]

type ApplicantRow = { id: string } & Record<EncryptedColumn, string | null>

// ─── Fetch batch ──────────────────────────────────────────────────────────────

/**
 * Returns rows where at least one *_encrypted column still carries a v1: (or
 * legacy unversioned) value.  Rows already fully migrated to v2: are excluded.
 */
async function fetchBatch(afterId: string | null): Promise<ApplicantRow[]> {
  const notV2Clauses = ENCRYPTED_COLUMNS.map(
    (col) => `(${col} IS NOT NULL AND ${col} NOT LIKE 'v2:%')`,
  ).join("\n       OR ")

  const cursorClause = afterId ? "AND id > $1" : ""
  const params: (string | number)[] = afterId ? [afterId, BATCH_SIZE] : [BATCH_SIZE]

  const { rows } = await pool.query<ApplicantRow>(
    `SELECT id, ${ENCRYPTED_COLUMNS.join(", ")}
     FROM public.applicants
     WHERE (
       ${notV2Clauses}
     )
     ${cursorClause}
     ORDER BY id
     LIMIT $${params.length}`,
    params,
  )

  return rows
}

// ─── Rekey row ────────────────────────────────────────────────────────────────

interface RekeyResult {
  rekeyedColumns: number
  skippedColumns: number
}

/**
 * For a single applicant row, decrypt every column that is NOT already v2:
 * using the old key, then re-encrypt with the new key and write back.
 * Wrapped in a transaction so a partial failure leaves the row unchanged.
 */
async function rekeyRow(row: ApplicantRow): Promise<RekeyResult> {
  const setClauses: string[] = []
  const values: string[] = []
  let rekeyedColumns = 0
  let skippedColumns = 0
  let idx = 1

  for (const col of ENCRYPTED_COLUMNS) {
    const stored = row[col]
    if (!stored) continue

    // Already migrated — skip
    if (stored.startsWith("v2:")) {
      skippedColumns++
      continue
    }

    try {
      const plaintext = decryptFieldWithKey(stored, OLD_KEY)
      const rekeyed = encryptFieldWithKey(plaintext, NEW_KEY)
      setClauses.push(`${col} = $${idx}`)
      values.push(rekeyed)
      idx++
      rekeyedColumns++
    } catch (err) {
      throw new Error(
        `Failed to decrypt ${col} for id=${row.id}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  if (setClauses.length > 0 && !DRY_RUN) {
    values.push(row.id)
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(
        `UPDATE public.applicants SET ${setClauses.join(", ")} WHERE id = $${idx}`,
        values,
      )
      await client.query("COMMIT")
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  }

  return { rekeyedColumns, skippedColumns }
}

// ─── Verification ─────────────────────────────────────────────────────────────

async function verify(): Promise<{ v1Remaining: number; v2Count: number }> {
  const notV2Clauses = ENCRYPTED_COLUMNS.map(
    (col) => `(${col} IS NOT NULL AND ${col} NOT LIKE 'v2:%')`,
  ).join("\n       OR ")

  const v2Clauses = ENCRYPTED_COLUMNS.map(
    (col) => `(${col} IS NOT NULL AND ${col} LIKE 'v2:%')`,
  ).join("\n       OR ")

  const [v1Result, v2Result] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.applicants WHERE (${notV2Clauses})`,
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.applicants WHERE (${v2Clauses})`,
    ),
  ])

  return {
    v1Remaining: parseInt(v1Result.rows[0]?.count ?? "0", 10),
    v2Count: parseInt(v2Result.rows[0]?.count ?? "0", 10),
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "🔍  PHI key-rotation — DRY RUN (no writes)" : "🔑  PHI key-rotation starting…")
  console.log(`    Batch size : ${BATCH_SIZE}`)
  console.log(`    Columns    : ${ENCRYPTED_COLUMNS.length}`)
  console.log("")

  // Quick sanity-check: verify both keys are different
  if (OLD_KEY.equals(NEW_KEY)) {
    console.error("❌  PROFILE_ENCRYPTION_KEY_OLD and PROFILE_ENCRYPTION_KEY_NEW are identical.")
    console.error("    Generate a fresh key with: openssl rand -hex 32")
    process.exit(1)
  }

  let totalRows = 0
  let totalRekeyed = 0
  let totalSkipped = 0
  let totalErrors = 0
  let lastId: string | null = null

  while (true) {
    const batch = await fetchBatch(lastId)
    if (batch.length === 0) break

    for (const row of batch) {
      try {
        const { rekeyedColumns, skippedColumns } = await rekeyRow(row)
        totalRekeyed += rekeyedColumns
        totalSkipped += skippedColumns
      } catch (err) {
        console.error(`\n❌  Row id=${row.id}: ${err instanceof Error ? err.message : String(err)}`)
        totalErrors++
        // Continue with remaining rows — re-running after fixing is safe.
      }
      totalRows++
    }

    lastId = batch[batch.length - 1]!.id
    process.stdout.write(
      `\r    Processed ${totalRows} rows | rekeyed ${totalRekeyed} cols | skipped ${totalSkipped} cols | errors ${totalErrors}…`,
    )
  }

  console.log("\n")

  if (totalErrors > 0) {
    console.warn(`⚠️  ${totalErrors} rows had errors — investigate above and re-run.`)
  }

  if (DRY_RUN) {
    console.log(`✅  Dry run complete.`)
    console.log(`    Rows that would be processed : ${totalRows}`)
    console.log(`    Column values to re-encrypt  : ${totalRekeyed}`)
    console.log(`    Column values already v2     : ${totalSkipped}`)
    console.log("")
    console.log("    Remove DRY_RUN=true to execute the migration.")
    await pool.end()
    return
  }

  console.log(`✅  Re-encryption complete.`)
  console.log(`    Rows processed               : ${totalRows}`)
  console.log(`    Column values re-encrypted   : ${totalRekeyed}`)
  console.log(`    Column values already v2     : ${totalSkipped}`)
  console.log(`    Errors                       : ${totalErrors}`)
  console.log("")

  // Post-migration verification
  console.log("🔍  Verifying…")
  const { v1Remaining, v2Count } = await verify()
  console.log(`    Rows with v2: columns        : ${v2Count}`)

  if (v1Remaining > 0) {
    console.warn(`⚠️  ${v1Remaining} rows still have non-v2 encrypted columns.`)
    console.warn("    Re-run this script after investigating the errors above.")
    console.warn("    Do NOT rotate the live PROFILE_ENCRYPTION_KEY until this reaches 0.")
  } else {
    console.log("    All encrypted columns are now v2. ✓")
    console.log("")
    console.log("    Next steps (see docs/PHI_KEY_ROTATION.md):")
    console.log("    1. gh secret set PROFILE_ENCRYPTION_KEY --body \"$PROFILE_ENCRYPTION_KEY_NEW\"")
    console.log("    2. Remove PROFILE_ENCRYPTION_KEY_OLD from all environments")
    console.log("    3. Deploy the clean encrypt.ts (remove v1: fallback code)")
  }

  await pool.end()
}

main().catch((err) => {
  console.error("\nFatal error:", err)
  pool.end().finally(() => process.exit(1))
})
