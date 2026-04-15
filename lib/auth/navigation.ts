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
  if (explicitNext !== "/customer/dashboard") return explicitNext

  try {
    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return explicitNext

    const payload = (await response.json()) as AuthMeResponse
    if (payload.roles.includes("admin")) return "/admin"
    if (payload.roles.includes("social_worker")) return "/social-worker/dashboard"
  } catch {
    // Fall back to the default redirect.
  }

  return explicitNext
}
