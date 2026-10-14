/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * SACA-2 rollout flag. Read at request time (not build time) so flipping the
 * environment variable needs a restart, not a rebuild. Off unless explicitly "true" or "1".
 */
export function isSaca2Enabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.SACA2_ENABLED?.trim().toLowerCase()
  return value === "true" || value === "1"
}
