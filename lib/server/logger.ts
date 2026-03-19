/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"

type LogLevel = "info" | "warn" | "error"

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

function writeLog(level: LogLevel, event: string, context?: Record<string, unknown>): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(context ? { context: sanitizeValue(context) } : {}),
  }

  const line = JSON.stringify(payload)
  if (level === "info") {
    console.info(line)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.error(line)
}

export function logServerError(event: string, error: unknown, context?: Record<string, unknown>): void {
  writeLog("error", event, {
    ...(context ?? {}),
    error: serializeError(error),
  })
}

export function logServerInfo(event: string, context?: Record<string, unknown>): void {
  writeLog("info", event, context)
}

