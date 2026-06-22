/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

type LogLevel = "error" | "warn" | "info" | "debug"

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn:  1,
  info:  2,
  debug: 3,
}

function getConfiguredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase()
  if (raw && raw in LOG_LEVEL_RANK) return raw as LogLevel
  return "info"
}

function isLevelEnabled(level: LogLevel): boolean {
  return LOG_LEVEL_RANK[level] <= LOG_LEVEL_RANK[getConfiguredLevel()]
}

const REDACTED_KEYS = new Set([
  "authorization",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "ssn",
  "dob",
])

const MAX_DEPTH = 3
const MAX_ARRAY_ITEMS = 20
const MAX_OBJECT_KEYS = 30
const MAX_STRING_LENGTH = 500

const TOP_LEVEL_CONTEXT_FIELDS = new Set([
  "agent",
  "counter",
  "duration_ms",
  "durationMs",
  "errorCode",
  "extractor",
  "fieldsFound",
  "hasMemory",
  "ip_hash",
  "language",
  "messageCount",
  "method",
  "metric",
  "mode",
  "module",
  "ms",
  "path",
  "reason",
  "role",
  "route",
  "sequence",
  "sessionId",
  "session_id",
  "status",
  "thresholdMs",
  "tool",
  "type",
  "userHash",
  "user_hash",
  "value",
])

function shouldRedactKey(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  return REDACTED_KEYS.has(normalized)
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...`
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (depth >= MAX_DEPTH) {
    return "[truncated]"
  }

  if (typeof value === "string") {
    return truncateString(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1))
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>
    const output: Record<string, unknown> = {}
    const entries = Object.entries(input).slice(0, MAX_OBJECT_KEYS)

    for (const [key, item] of entries) {
      output[key] = shouldRedactKey(key) ? "[redacted]" : sanitizeValue(item, depth + 1)
    }

    return output
  }

  return String(value)
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncateString(error.message),
      stack:
        process.env.NODE_ENV === "development" && typeof error.stack === "string"
          ? truncateString(error.stack)
          : undefined,
    }
  }

  return {
    message: truncateString(String(error)),
  }
}

function isTopLevelLogFieldValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

function getTopLevelContextFields(sanitizedContext: unknown): Record<string, string | number | boolean> {
  if (!sanitizedContext || typeof sanitizedContext !== "object" || Array.isArray(sanitizedContext)) {
    return {}
  }

  const fields: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(sanitizedContext as Record<string, unknown>)) {
    if (!TOP_LEVEL_CONTEXT_FIELDS.has(key) || !isTopLevelLogFieldValue(value)) continue
    fields[key] = value
  }

  return fields
}

// ─── OpenObserve shipping ─────────────────────────────────────────────────────

function getOOCredentials(): { url: string; auth: string; org: string; stream: string } | null {
  const url  = process.env.OPENOBSERVE_URL
  const user = process.env.OPENOBSERVE_USER
  const pass = process.env.OPENOBSERVE_PASSWORD
  if (!url || !user || !pass) return null
  return {
    url,
    auth:   Buffer.from(`${user}:${pass}`).toString("base64"),
    org:    process.env.OPENOBSERVE_ORG    ?? "default",
    stream: process.env.OPENOBSERVE_STREAM ?? "mhealth-app",
  }
}

function shipToOpenObserve(payload: Record<string, unknown>): void {
  const creds = getOOCredentials()
  if (!creds) return

  const { url, auth, org, stream } = creds

  // Fire-and-forget — never block the response path or throw
  void fetch(`${url}/api/${org}/${stream}/_json`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Basic ${auth}`,
    },
    body: JSON.stringify([payload]),
  }).catch(() => undefined)
}

// ─── Core write ───────────────────────────────────────────────────────────────

function writeLog(level: LogLevel, event: string, context?: Record<string, unknown>): void {
  if (!isLevelEnabled(level)) return

  const sanitizedContext = context ? sanitizeValue(context) : undefined

  const payload = {
    _timestamp: Date.now() * 1000, // OpenObserve expects microseconds
    ts:         new Date().toISOString(),
    level,
    event,
    service:    "mhealth-app",
    env:        process.env.NODE_ENV ?? "development",
    ...(sanitizedContext ? getTopLevelContextFields(sanitizedContext) : {}),
    ...(sanitizedContext ? { context: sanitizedContext } : {}),
  }

  const line = JSON.stringify(payload)
  if (level === "debug") {
    console.debug(line)
  } else if (level === "info") {
    console.info(line)
  } else if (level === "warn") {
    console.warn(line)
  } else {
    console.error(line)
  }

  shipToOpenObserve(payload)
}

export function logServerError(event: string, error: unknown, context?: Record<string, unknown>): void {
  writeLog("error", event, {
    ...(context ?? {}),
    error: serializeError(error),
  })
}

export function logServerWarn(event: string, context?: Record<string, unknown>): void {
  writeLog("warn", event, context)
}

export function logServerInfo(event: string, context?: Record<string, unknown>): void {
  writeLog("info", event, context)
}

export function logServerDebug(event: string, context?: Record<string, unknown>): void {
  writeLog("debug", event, context)
}
