/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

/**
 * Shared formatting utilities used across pages and components.
 */

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Format an ISO date string as a short human-readable date.
 * Returns "—" for null/invalid values.
 *
 * @param value  - ISO 8601 date/datetime string, or null/undefined
 * @param locale - BCP 47 locale tag (defaults to "en-US")
 */
export function formatDate(value: string | null | undefined, locale = "en-US"): string {
  const date = parseDate(value)
  if (!date) return "—"
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

/**
 * Format an ISO date string as a short human-readable date + time.
 * Returns "—" for null/invalid values.
 *
 * @param value  - ISO 8601 datetime string, or null/undefined
 * @param locale - BCP 47 locale tag (defaults to "en-US")
 */
export function formatDateTime(value: string | null | undefined, locale = "en-US"): string {
  const date = parseDate(value)
  if (!date) return "—"
  return date.toLocaleString(locale, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Format a number as USD currency (no cents).
 * e.g. 1500 → "$1,500"
 */
export function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}

/**
 * Format a monthly dollar value with "/month" suffix.
 * e.g. 1500 → "$1,500/month"
 */
export function formatMonthly(value: number): string {
  return `${formatCurrency(value)}/month`
}

/**
 * Format a file size in bytes as a human-readable string.
 * e.g. 1048576 → "1.00 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * Format an ISO date string as a short time string (e.g. "2:05 PM").
 */
export function formatTime(iso: string): string {
  const date = parseDate(iso)
  if (!date) return "—"
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Format a timestamp relative to now.
 * e.g. "just now", "5m ago", "3h ago", "2d ago", or a locale date for older items.
 */
export function formatRelativeTime(
  value: string | null | undefined,
  options?: { capitalize?: boolean; locale?: string },
): string {
  const date = parseDate(value)
  if (!date) return "—"

  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60_000)

  let label: string
  if (mins < 1) label = "just now"
  else if (mins < 60) label = `${mins}m ago`
  else {
    const hours = Math.floor(mins / 60)
    if (hours < 24) label = `${hours}h ago`
    else {
      const days = Math.floor(hours / 24)
      if (days < 7) label = `${days}d ago`
      else label = date.toLocaleDateString(options?.locale)
    }
  }

  if (!options?.capitalize) return label
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

/**
 * Format a chat/session day divider label.
 * Returns "Today", "Yesterday", or a short month/day date.
 */
export function formatConversationDateLabel(value: string | null | undefined, locale = "en-US"): string {
  const date = parseDate(value)
  if (!date) return "—"

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  })
}

/**
 * Format an ISO date string as a short month/day + time string.
 * e.g. "Mar 15, 2:30 PM".
 */
export function formatShortDateTime(value: string | null | undefined, locale?: string): string {
  const date = parseDate(value)
  if (!date) return "—"
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
