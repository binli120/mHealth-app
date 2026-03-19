/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import * as ModuleUnderTest from "@/lib/pdf/masshealth-aca"

describe("lib/pdf/masshealth-aca", () => {
  it("exports module members", () => {
    expect(ModuleUnderTest).toBeTruthy()
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0)
  })
})
