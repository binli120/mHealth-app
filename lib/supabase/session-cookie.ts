/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

interface SupabaseSessionLike {
  access_token?: string
}

export async function syncSessionCookie(session: SupabaseSessionLike | null | undefined): Promise<void> {
  if (!session?.access_token) return

  await fetch("/api/auth/session-cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ accessToken: session.access_token }),
  })
}

export async function clearSessionCookie(): Promise<void> {
  await fetch("/api/auth/session-cookie", {
    method: "DELETE",
    credentials: "same-origin",
  })
}
