/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Shared auth navigation helpers.
 * @author: Bin Lee
 */

interface AuthMeResponse {
  roles: string[]
  swStatus: string | null
}

export function getSafeAuthNextPath(nextPath: string | null, fallback: string): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.startsWith("/auth/")) {
    return fallback
  }
  return nextPath
}

export async function resolvePostAuthRedirect(explicitNext: string, accessToken: string): Promise<string> {
  // MFA setup after registration must reach the setup page regardless of role.
  if (explicitNext === "/setup-mfa" || explicitNext.startsWith("/setup-mfa?")) {
    return explicitNext
  }

  // If the user is already headed to a role-specific area they belong to, trust it.
  // Role-specific prefixes are guarded by their own server-side checks.
  if (
    explicitNext.startsWith("/admin") ||
    explicitNext.startsWith("/social-worker") ||
    explicitNext.startsWith("/reviewer")
  ) {
    return explicitNext
  }

  // For any other destination (customer dashboard, application flows, etc.)
  // verify the user's role and redirect privileged accounts to the right home.
  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return explicitNext

    const payload = (await response.json()) as AuthMeResponse
    if (payload.roles.includes("admin")) return "/admin"
    if (
      payload.roles.includes("reviewer") ||
      payload.roles.includes("case_reviewer") ||
      payload.roles.includes("supervisor")
    ) {
      return "/reviewer/dashboard"
    }
    if (payload.roles.includes("social_worker")) return "/social-worker/dashboard"
  } catch {
    // Fall back to the explicit next on network/parse error.
  }

  return explicitNext
}
