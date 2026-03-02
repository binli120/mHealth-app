import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/use-toast"

describe("components/ui/use-toast", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
