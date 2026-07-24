import { realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { describe, expect, it } from "vitest"
import { exitCodeToStatus, runSpawnCheck } from "../checks/_spawn.mjs"

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

describe("runSpawnCheck", () => {
  it("spawns the process in the given cwd, not the caller's cwd", async () => {
    const dir = realpathSync(tmpdir())
    const result = await runSpawnCheck(
      "cwd-check",
      "node",
      ["-e", "process.exit(process.cwd() === process.argv[1] ? 0 : 1)", dir],
      { quiet: true, cwd: dir },
    )
    expect(result.status).toBe("pass")
  })
})
