#!/usr/bin/env node
/**
 * Sync local public schema data to a Supabase cloud project.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[pass]@aws-1-us-east-1.pooler.supabase.com:5432/postgres" \
 *     node scripts/sync-data-to-cloud.mjs
 *
 * Or for prod specifically:
 *   pnpm db:sync:prod   (requires SUPABASE_DB_URL_PROD in .env.production)
 *
 * @author Bin Lee
 */

import { execSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const DUMPS_DIR = join(ROOT, "database", "dumps")
const PG_DUMP = "/opt/homebrew/bin/pg_dump"
const PSQL    = "/opt/homebrew/bin/psql"

const LOCAL_DB  = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
const REMOTE_DB = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DB_URL_PROD

if (!REMOTE_DB) {
  console.error("❌  Set SUPABASE_DB_URL or SUPABASE_DB_URL_PROD before running this script.")
  console.error("    Example:")
  console.error('    SUPABASE_DB_URL="postgresql://postgres.[ref]:[pass]@aws-1-us-east-1.pooler.supabase.com:5432/postgres" \\')
  console.error("      node scripts/sync-data-to-cloud.mjs")
  process.exit(1)
}

mkdirSync(DUMPS_DIR, { recursive: true })

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const dumpFile = join(DUMPS_DIR, `public_data_${ts}.sql`)

console.log("📦  Dumping local public schema data…")
const dump = spawnSync(PG_DUMP, [
  LOCAL_DB,
  "--data-only",
  "--schema=public",
  "--no-owner", "--no-acl",
  "--column-inserts",
  "--on-conflict-do-nothing",
  "--exclude-table=public.schema_migrations",
  "-f", dumpFile,
], { stdio: "inherit" })

if (dump.status !== 0) {
  console.error("❌  pg_dump failed.")
  process.exit(1)
}
console.log(`✅  Dump written to ${dumpFile}`)

console.log("☁️   Restoring to cloud…")
const restore = spawnSync(PSQL, [
  REMOTE_DB,
  "-v", "ON_ERROR_STOP=0",
  "-f", dumpFile,
], {
  stdio: "inherit",
  env: { ...process.env, PGPASSWORD: new URL(REMOTE_DB).password },
})

if (restore.status !== 0) {
  console.error("❌  psql restore failed.")
  process.exit(1)
}
console.log("✅  Cloud database synced successfully.")
