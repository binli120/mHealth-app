import { describe, expect, it } from "vitest"
import { classifyHttpResult } from "../checks/_http.mjs"

describe("classifyHttpResult", () => {
  it("passes on an expected status", () => {
    const result = classifyHttpResult({
      name: "app",
      elapsedMs: 42,
      response: { status: 200 },
      error: null,
      expectedStatuses: [200],
    })
    expect(result).toEqual({ name: "app", status: "pass", detail: "HTTP 200", durationMs: 42 })
  })

  it("fails on an unexpected status", () => {
    const result = classifyHttpResult({
      name: "app",
      elapsedMs: 10,
      response: { status: 500 },
      error: null,
      expectedStatuses: [200],
    })
    expect(result.status).toBe("fail")
    expect(result.detail).toContain("500")
  })

  it("fails when the request errors (timeout, DNS, etc.)", () => {
    const result = classifyHttpResult({
      name: "app",
      elapsedMs: 8000,
      response: null,
      error: new Error("The operation was aborted"),
      expectedStatuses: [200],
    })
    expect(result.status).toBe("fail")
    expect(result.detail).toContain("aborted")
  })
})
