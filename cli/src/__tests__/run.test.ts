import { describe, expect, it } from "vitest"
import { ALL_CATEGORIES, parseCliArgs } from "../run.mjs"

describe("parseCliArgs", () => {
  it("defaults to the check command and every category with no args", () => {
    const args = parseCliArgs([])
    expect(args.command).toBe("check")
    expect(args.categories).toEqual(ALL_CATEGORIES)
    expect(args.domain).toBe("healthcompass.cloud")
    expect(args.timeoutMs).toBe(8000)
    expect(args.json).toBe(false)
    expect(args.quiet).toBe(false)
  })

  it("recognizes the update and version commands", () => {
    expect(parseCliArgs(["update"]).command).toBe("update")
    expect(parseCliArgs(["version"]).command).toBe("version")
  })

  it("narrows to only the requested categories, preserving run order", () => {
    const args = parseCliArgs(["--e2e", "--lint"])
    expect(args.categories).toEqual(["lint", "e2e"])
  })

  it("reads --domain and --timeout", () => {
    const args = parseCliArgs(["--domain", "example.com", "--timeout", "5000"])
    expect(args.domain).toBe("example.com")
    expect(args.timeoutMs).toBe(5000)
  })

  it("throws on unknown flags", () => {
    expect(() => parseCliArgs(["--bogus"])).toThrow()
  })
})
