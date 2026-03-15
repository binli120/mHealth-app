import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/components/ui/calendar"

describe("components/ui/calendar", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
