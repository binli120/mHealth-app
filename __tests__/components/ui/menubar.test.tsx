import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/menubar"

describe("components/ui/menubar", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
