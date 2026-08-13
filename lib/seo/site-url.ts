/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/** Canonical site origin used by metadata, robots.txt, and the sitemap. */
export function getSiteUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  try {
    return new URL(appUrl || "https://healthcompass.cloud").origin
  } catch {
    return "https://healthcompass.cloud"
  }
}
