import { afterEach, describe, expect, it, vi } from "vitest"

import { generateKey } from "@/lib/phi-token/crypto"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("generateKey", () => {
  it("explains how to recover when browser encryption is unavailable", async () => {
    vi.stubGlobal("crypto", {})

    await expect(generateKey()).rejects.toThrow(
      "Secure browser encryption is unavailable. Open this app at http://localhost:3001 and try again.",
    )
  })
})
