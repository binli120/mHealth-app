import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/radio-group"

describe("components/ui/radio-group", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
