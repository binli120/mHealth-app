import { describe, expect, it } from "vitest"
import { classifySshExit } from "../checks/vps.mjs"

describe("classifySshExit", () => {
  it("passes when check-services.sh exits 0", () => {
    const result = classifySshExit({ code: 0, stderr: "", durationMs: 500 })
    expect(result).toEqual({ name: "vps", status: "pass", detail: "all containers healthy", durationMs: 500 })
  })

  it("skips when the SSH alias can't be resolved", () => {
    const result = classifySshExit({
      code: 255,
      stderr: "ssh: Could not resolve hostname healthcompass-vps: nodename nor servname provided",
      durationMs: 100,
    })
    expect(result.status).toBe("skip")
    expect(result.detail).toContain("healthcompass-vps")
  })

  it("skips when publickey auth is rejected (key not set up yet)", () => {
    const result = classifySshExit({
      code: 255,
      stderr: "user@host: Permission denied (publickey).",
      durationMs: 100,
    })
    expect(result.status).toBe("skip")
  })

  it("fails when the script itself reports failures", () => {
    const result = classifySshExit({
      code: 1,
      stderr: "3 failure(s), 0 warning(s).",
      durationMs: 900,
    })
    expect(result.status).toBe("fail")
    expect(result.detail).toContain("failure")
  })
})
