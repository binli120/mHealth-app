/**
 * OpenTelemetry PHI-filtering hooks.
 *
 * Extracted from instrumentation.ts as pure, synchronous functions so they
 * can be unit-tested without spinning up the OTel SDK or Next.js runtime.
 *
 * @author Bin Lee
 */

import type { Span } from "@opentelemetry/api"
import type { IncomingMessage } from "http"
import type { PgRequestHookInformation } from "@opentelemetry/instrumentation-pg"

// ── HTTP — ignore list ─────────────────────────────────────────────────────────

/**
 * Returns `true` for requests that should be excluded from tracing:
 *   • `/api/health` — noisy heartbeat with no diagnostic value
 *   • `/_next/*`    — static JS/CSS bundles and image-optimisation requests
 *   • Common public-directory assets (favicon, apple-icon, robots, sitemap)
 */
export function shouldIgnoreIncomingRequest(request: IncomingMessage): boolean {
  const url = request.url ?? ""
  return (
    url === "/api/health"          ||
    url.startsWith("/_next/")      ||
    url.startsWith("/favicon")     ||
    url.startsWith("/apple-icon")  ||
    url.startsWith("/robots.txt")  ||
    url.startsWith("/sitemap.xml")
  )
}

// ── HTTP — request hook ────────────────────────────────────────────────────────

/**
 * Sensitive headers that must never appear in trace backends.
 * OTel does not capture headers by default, but we redact them defensively
 * so that a future `headersToSpanAttributes` config change cannot leak them.
 */
const REDACTED_REQUEST_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-supabase-session",
] as const

/**
 * Scrubs PHI-bearing and auth-bearing attributes from an HTTP request span:
 *   1. Clears `url.query` — query strings may carry OAuth tokens or user input.
 *   2. Overwrites `http.target` with the path-only URL (strips the query string).
 *   3. Redacts sensitive request headers (`authorization`, `cookie`, …).
 *
 * Works for both server-side (`IncomingMessage`) and client-side (`ClientRequest`)
 * spans — the path is read from `.url` or `.path` depending on which is present.
 */
export function scrubHttpRequestSpan(
  span: Span,
  request: { url?: unknown; path?: unknown },
): void {
  // Blank the query string attribute
  span.setAttribute("url.query", "")

  // Derive the path-without-query from the request object and overwrite http.target
  const rawPath =
    typeof request.url === "string"
      ? request.url
      : typeof request.path === "string"
        ? request.path
        : ""
  const pathOnly = rawPath.split("?")[0] ?? rawPath
  if (pathOnly) span.setAttribute("http.target", pathOnly)

  // Defensively redact sensitive headers
  for (const header of REDACTED_REQUEST_HEADERS) {
    span.setAttribute(`http.request.header.${header}`, "[REDACTED]")
  }
}

// ── HTTP — response hook ───────────────────────────────────────────────────────

/**
 * Removes `set-cookie` from response spans.
 * Session tokens embedded in Set-Cookie values must not reach the trace backend.
 */
export function scrubHttpResponseSpan(span: Span): void {
  span.setAttribute("http.response.header.set-cookie", "[REDACTED]")
}

// ── Postgres — request hook ────────────────────────────────────────────────────

/**
 * Pattern that matches a literal AES-256-GCM ciphertext in our `v1:iv:tag:ct`
 * format, or a bare SSN (###-##-####) that isn't preceded by a `$` parameter
 * placeholder — both indicate string interpolation instead of parameterized queries.
 *
 * Parameterized queries look like `WHERE id = $1` — the `(?<!\$)` lookbehind
 * ensures we don't match `$1`-style placeholders that happen to end in digits.
 */
const PHI_IN_SQL_PATTERN = /v1:[0-9a-f]{24,}:|(?<!\$)\d{3}-\d{2}-\d{4}(?!\d)/

/**
 * Redacts `db.statement` when the raw query text contains a literal encrypted
 * PHI value or a plain SSN — a sign that string interpolation was used instead
 * of parameterized queries.
 *
 * With `enhancedDatabaseReporting: false` (the explicit default we set in
 * instrumentation.ts), query *parameter values* are never included in
 * `db.statement`.  This hook only fires when PHI leaks into the *query text
 * itself*, which is a programming error we want to surface loudly.
 */
export function scrubPgStatement(
  span: Span,
  queryInfo: PgRequestHookInformation,
): void {
  const text = queryInfo.query.text ?? ""
  if (PHI_IN_SQL_PATTERN.test(text)) {
    span.setAttribute(
      "db.statement",
      "[REDACTED: literal PHI detected in query text — use parameterized queries]",
    )
    console.error(
      "[instrumentation] PHI detected in raw SQL query text. " +
      "Use parameterized queries ($1, $2 …) instead of string interpolation.",
    )
  }
}
