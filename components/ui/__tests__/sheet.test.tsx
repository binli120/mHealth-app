import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/sheet"

describe("components/ui/sheet", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
