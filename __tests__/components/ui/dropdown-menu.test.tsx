import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/dropdown-menu"

describe("components/ui/dropdown-menu", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
