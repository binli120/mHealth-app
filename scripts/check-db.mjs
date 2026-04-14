/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { Pool } from "pg"

function resolveDatabaseUrl() {
  if (process.env.NODE_ENV === "production") {
    return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL
  }

  return process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
}

const connectionString = resolveDatabaseUrl()

if (!connectionString) {
  console.error("Missing DATABASE_URL (or DATABASE_URL_DEV / DATABASE_URL_PROD).")
  process.exit(1)
}

const pool = new Pool({ connectionString })

try {
  const result = await pool.query(
    "select current_database() as database_name, current_user as user_name"
  )
  const row = result.rows[0]
  console.log(`Connected to database "${row.database_name}" as "${row.user_name}".`)
} catch (error) {
  console.error("Database connection failed.")
  if (error instanceof Error) {
    console.error(error.message)
  } else {
    console.error(String(error))
  }
  process.exitCode = 1
} finally {
  await pool.end()
}
