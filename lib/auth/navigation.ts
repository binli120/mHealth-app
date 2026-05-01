/**
 * Shared auth navigation helpers.
 * @author Bin Lee
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
  // If the user is already headed to a role-specific area they belong to, trust it.
  // Admin and social-worker prefixes are guarded by their own server-side checks.
  if (explicitNext.startsWith("/admin") || explicitNext.startsWith("/social-worker")) {
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
    if (payload.roles.includes("social_worker")) return "/social-worker/dashboard"
  } catch {
    // Fall back to the explicit next on network/parse error.
  }

  return explicitNext
}
