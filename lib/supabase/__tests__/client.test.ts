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
})
