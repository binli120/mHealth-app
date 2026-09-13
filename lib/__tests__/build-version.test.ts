/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"

import { composeAppVersion } from "../build-version.mjs"

describe("composeAppVersion", () => {
  it("uses the git commit count as the patch segment", () => {
    expect(composeAppVersion("1.0.0", "327")).toBe("1.0.327")
  })

  it("keeps major.minor from package.json and replaces only the patch", () => {
    expect(composeAppVersion("2.5.9", "41")).toBe("2.5.41")
  })

  it("falls back to the package.json patch when no build number is given", () => {
    expect(composeAppVersion("1.0.4", undefined)).toBe("1.0.4")
    expect(composeAppVersion("1.0.4", null)).toBe("1.0.4")
    expect(composeAppVersion("1.0.4", "")).toBe("1.0.4")
  })

  it("falls back to the package.json patch when the build number is not digits-only", () => {
    expect(composeAppVersion("1.0.4", "abc123")).toBe("1.0.4")
    expect(composeAppVersion("1.0.4", "12x")).toBe("1.0.4")
  })

  it("tolerates a short or empty package version", () => {
    expect(composeAppVersion("1", "9")).toBe("1.0.9")
    expect(composeAppVersion("", "9")).toBe("0.0.9")
  })
})
