/**
 * Shared formatting utilities used across pages and components.
 */

/**
 * Format an ISO date string as a short human-readable date.
 * Returns "-" for null/invalid values.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
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
