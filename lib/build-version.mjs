/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * Compose the public app version string shown in the footer and logged to the
 * browser console.
 *
 * `major.minor` are human-owned in package.json. `patch` is the build number —
 * normally `git rev-list --count HEAD`, injected at build time so every
 * production build increments it with no committed file churn. When no valid
 * build number is available (e.g. a Docker build with `.git` excluded and the
 * env var unset), the patch from package.json is kept as a fallback.
 *
 * @param {string} pkgVersion - `version` field from package.json (e.g. "1.0.0").
 * @param {string | null | undefined} buildNumber - digits-only build number.
 * @returns {string} `${major}.${minor}.${patch}` (e.g. "1.0.327").
 */
export function composeAppVersion(pkgVersion, buildNumber) {
  const [rawMajor, rawMinor, rawPatch] = String(pkgVersion ?? "").split(".")
  const major = rawMajor || "0"
  const minor = rawMinor || "0"
  const pkgPatch = rawPatch || "0"
  const patch = typeof buildNumber === "string" && /^\d+$/.test(buildNumber) ? buildNumber : pkgPatch
  return `${major}.${minor}.${patch}`
}
