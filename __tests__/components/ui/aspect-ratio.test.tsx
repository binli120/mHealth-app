import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/aspect-ratio"

describe("components/ui/aspect-ratio", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
