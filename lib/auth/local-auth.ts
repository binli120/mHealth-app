/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0", "::1"])

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true
  }

  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false
  }

  return null
}

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase()
}

function isLocalUrl(url: string | undefined): boolean | null {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    return LOCAL_HOSTS.has(parsed.hostname)
  } catch {
    return null
  }
}

function resolveLocalRuntime(): boolean {
  const bySupabaseUrl = isLocalUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  )
  if (bySupabaseUrl !== null) {
    return bySupabaseUrl
  }

  const byDbUrl = isLocalUrl(
    process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || process.env.DATABASE_URL_PROD,
  )
  if (byDbUrl !== null) {
    return byDbUrl
  }

  if (typeof window !== "undefined") {
    return LOCAL_HOSTS.has(window.location.hostname)
  }

  return process.env.NODE_ENV === "test"
}

/**
 * Returns true only when at least one connection URL is available and it
 * resolves to a non-local host — i.e. we have positive evidence of a cloud
 * database.  Returns false when every checked URL is absent (null) or local.
 *
 * This is intentionally stricter than `resolveLocalRuntime()`: we only block
 * when we can *prove* the database is remote.  An environment with no URLs at
 * all gets the benefit of the doubt.
 */
function isPositivelyCloudDb(): boolean {
  const bySupabaseUrl = isLocalUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  )
  // isLocalUrl returns false when the URL is present AND non-local.
  if (bySupabaseUrl === false) {
    return true
  }

  const byDbUrl = isLocalUrl(
    process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || process.env.DATABASE_URL_PROD,
  )
  if (byDbUrl === false) {
    return true
  }

  return false
}

export function isLocalAuthHelperEnabled(): boolean {
  // Hard block in production — no flag can override this. Dev auth routes
  // (register, grant-admin, auto-confirm) must never be reachable in production
  // because they bypass normal Supabase Auth flows and could allow arbitrary
  // account creation or privilege escalation.
  if (process.env.NODE_ENV === "production") {
    return false
  }

  const explicit =
    parseBoolean(process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS) ??
    parseBoolean(process.env.ENABLE_LOCAL_AUTH_HELPERS)

  if (explicit === false) {
    return false
  }

  if (explicit === true) {
    // Security guard: even with an explicit opt-in, block if there is
    // positive evidence of a cloud-hosted database (Supabase URL or
    // DATABASE_URL points to a remote host).
    //
    // We use isPositivelyCloudDb() rather than resolveLocalRuntime() here
    // so that environments with no URL env vars set (e.g. a developer who
    // set the flag but hasn't configured Supabase locally yet) still get
    // benefit of the doubt.  resolveLocalRuntime() would return false in
    // that case (no evidence of localhost), which would silently break the
    // default local-dev workflow.
    //
    // This guard only applies to server-side API route handlers (where
    // typeof window === "undefined"), so the window.hostname branch of
    // resolveLocalRuntime() is not needed here.
    return !isPositivelyCloudDb()
  }

  // No explicit flag: auto-detect from connection URLs / window hostname.
  return resolveLocalRuntime()
}
