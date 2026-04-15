/**
 * Utilities for the Admin Analytics page.
 * @author Bin Lee
 */

export function formatAnalyticsMonth(ym: string): string {
  const [year, month] = ym.split("-")
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleString("default", {
    month: "short",
    year: "2-digit",
  })
}

export function formatRelativeActivityTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}
