import { describe, expect, it } from "vitest"
import { certStatus } from "../checks/edge.mjs"

describe("certStatus", () => {
  const now = new Date("2026-07-23T00:00:00Z")

  it("passes when expiry is well beyond the warn window", () => {
    const validTo = new Date("2026-09-01T00:00:00Z")
    expect(certStatus(validTo, now, 14)).toBe("pass")
  })

  it("warns when expiry is inside the warn window", () => {
    const validTo = new Date("2026-07-30T00:00:00Z")
    expect(certStatus(validTo, now, 14)).toBe("warn")
  })

  it("fails when the certificate has already expired", () => {
    const validTo = new Date("2026-07-01T00:00:00Z")
    expect(certStatus(validTo, now, 14)).toBe("fail")
  })
})
