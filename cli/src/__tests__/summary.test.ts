import { describe, expect, it } from "vitest"
import { deriveExitCode, formatJson, summaryLabel } from "../summary.mjs"

const base = { name: "lint", detail: "ok", durationMs: 10 }

describe("deriveExitCode", () => {
  it("returns 0 when nothing fails", () => {
    expect(
      deriveExitCode([
        { ...base, status: "pass" },
        { ...base, status: "warn" },
        { ...base, status: "skip" },
      ]),
    ).toBe(0)
  })

  it("returns 1 when any check fails", () => {
    expect(
      deriveExitCode([{ ...base, status: "pass" }, { ...base, status: "fail" }]),
    ).toBe(1)
  })
})

describe("summaryLabel", () => {
  it("is healthy when all pass or skip", () => {
    expect(
      summaryLabel([{ ...base, status: "pass" }, { ...base, status: "skip" }]),
    ).toBe("healthy")
  })

  it("is warn when a check warns but none fail", () => {
    expect(
      summaryLabel([{ ...base, status: "pass" }, { ...base, status: "warn" }]),
    ).toBe("warn")
  })

  it("is degraded when any check fails", () => {
    expect(
      summaryLabel([{ ...base, status: "fail" }, { ...base, status: "warn" }]),
    ).toBe("degraded")
  })
})

describe("formatJson", () => {
  it("shapes the payload as { ok, summary, results }", () => {
    const results = [{ ...base, status: "pass" }]
    expect(JSON.parse(formatJson(results))).toEqual({
      ok: true,
      summary: "healthy",
      results,
    })
  })
})
