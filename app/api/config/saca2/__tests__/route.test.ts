/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/config/saca2/route"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("GET /api/config/saca2", () => {
  it("reports disabled by default and is not cacheable", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enabled: false })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("reports enabled when SACA2_ENABLED=true at request time", async () => {
    vi.stubEnv("SACA2_ENABLED", "true")
    expect(await (await GET()).json()).toEqual({ enabled: true })
  })
})
