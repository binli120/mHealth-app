import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/dialog"

describe("components/ui/dialog", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
