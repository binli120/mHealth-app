/**
 * @author Bin Lee
 * @email binlee120@gmail.com
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

export function isLocalAuthHelperEnabled(): boolean {
  const explicit =
    parseBoolean(process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS) ??
    parseBoolean(process.env.ENABLE_LOCAL_AUTH_HELPERS)

  if (explicit !== null) {
    return explicit && resolveLocalRuntime()
  }

  return resolveLocalRuntime()
}
