import { describe, expect, it } from "vitest"
import { exitCodeToStatus } from "../checks/_spawn.mjs"

describe("exitCodeToStatus", () => {
  it("maps exit code 0 to pass", () => {
    expect(exitCodeToStatus(0)).toBe("pass")
  })

  it("maps any non-zero code to fail", () => {
    expect(exitCodeToStatus(1)).toBe("fail")
    expect(exitCodeToStatus(127)).toBe("fail")
  })

  it("maps null (process killed/never exited) to fail", () => {
    expect(exitCodeToStatus(null)).toBe("fail")
  })
})
