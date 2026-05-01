/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const createClientMock = vi.fn()

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}))

describe("lib/supabase/client", () => {
  beforeEach(() => {
    vi.resetModules()
    createClientMock.mockReset()
    window.localStorage.clear()
    window.sessionStorage.clear()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  })

  it("throws when required env vars are missing", async () => {
    const { getSupabaseClient } = await import("@/lib/supabase/client")

    expect(() => getSupabaseClient()).toThrow(/Missing Supabase env vars/)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it("creates and memoizes supabase client", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon"

    const fakeClient = {
      from: vi.fn(),
      auth: {
        getSession: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({}),
      },
    }
    createClientMock.mockReturnValue(fakeClient)

    const { getSupabaseClient } = await import("@/lib/supabase/client")
    const first = getSupabaseClient()
    const second = getSupabaseClient()

    expect(first).toBe(fakeClient)
    expect(second).toBe(fakeClient)
    expect(createClientMock).toHaveBeenCalledTimes(1)
    expect(createClientMock).toHaveBeenCalledWith("https://example.supabase.co", "anon")
  })

  it("clears Supabase auth cache during sign out", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon"

    const fakeClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    }
    createClientMock.mockReturnValue(fakeClient)
    window.localStorage.setItem("sb-example-auth-token", "token")
    window.localStorage.setItem("supabase.auth.token", "legacy-token")
    window.localStorage.setItem("unrelated", "keep")
    window.sessionStorage.setItem("sb-example-auth-token", "token")

    const { signOutAndClearLocalAuth } = await import("@/lib/supabase/client")
    await signOutAndClearLocalAuth()

    expect(fakeClient.auth.signOut).toHaveBeenCalledWith()
    expect(window.localStorage.getItem("sb-example-auth-token")).toBeNull()
    expect(window.localStorage.getItem("supabase.auth.token")).toBeNull()
    expect(window.sessionStorage.getItem("sb-example-auth-token")).toBeNull()
    expect(window.localStorage.getItem("unrelated")).toBe("keep")
  })
})
