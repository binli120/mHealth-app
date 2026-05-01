/**
 * Unit tests for app/api/auth/passkey/logout/route.ts
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, it, expect } from "vitest"

import { POST } from "@/app/api/auth/passkey/logout/route"
import { ADMIN_PASSKEY_SESSION_COOKIE } from "@/lib/auth/passkey-session"

function makeRequest() {
  return new Request("http://localhost/api/auth/passkey/logout", { method: "POST" })
}

// ── POST /api/auth/passkey/logout ─────────────────────────────────────────────

describe("POST /api/auth/passkey/logout", () => {
  it("returns 200 with ok:true", async () => {
    const response = await POST()
    const body = await response.json() as { ok: boolean }
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it("sets the session cookie to empty with maxAge 0 (clears it)", async () => {
    const response = await POST()
    const setCookie = response.headers.get("set-cookie")
    expect(setCookie).toContain(ADMIN_PASSKEY_SESSION_COOKIE)
    expect(setCookie).toMatch(/max-age=0/i)
  })
})
