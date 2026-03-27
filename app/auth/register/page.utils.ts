/**
 * Utility functions for the Register page.
 * @author Bin Lee
 */

export function getSafeNextPath(nextPath: string | null, fallback: string): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.startsWith("/auth/")) {
    return fallback
  }
  return nextPath
}
