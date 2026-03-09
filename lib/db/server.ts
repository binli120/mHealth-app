import "server-only"

import { Pool } from "pg"

type GlobalWithDb = typeof globalThis & {
  __mhealthDbPool?: Pool
}

const globalForDb = globalThis as GlobalWithDb

function resolveDatabaseUrl() {
  if (process.env.NODE_ENV === "production") {
    return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL
  }

  return process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
}

export function getDbPool() {
  if (globalForDb.__mhealthDbPool) {
    return globalForDb.__mhealthDbPool
  }

  const connectionString = resolveDatabaseUrl()

  if (!connectionString) {
    throw new Error(
      "Missing database connection string. Set DATABASE_URL (or DATABASE_URL_DEV / DATABASE_URL_PROD)."
    )
  }

  const pool = new Pool({
    connectionString,
  })

  globalForDb.__mhealthDbPool = pool

  return pool
}

export async function pingDatabase() {
  const pool = getDbPool()
  await pool.query("SELECT 1")
}
