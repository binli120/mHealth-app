import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/tabs"

describe("components/ui/tabs", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
