/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { EventEmitter } from "node:events"
import { beforeEach, describe, expect, it, vi } from "vitest"

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
  default: { spawn: spawnMock },
}))

import {
  fetchBenefitPolicyUpdatesFromAnalysisService,
  fetchBenefitPolicyUpdatesFromLocalPython,
} from "@/lib/masshealth/benefit-policy-updates-client"

class FakeStream extends EventEmitter {
  setEncoding = vi.fn()
}

function makeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: FakeStream
    stderr: FakeStream
    stdin: { end: ReturnType<typeof vi.fn> }
  }
  child.stdout = new FakeStream()
  child.stderr = new FakeStream()
  child.stdin = { end: vi.fn() }
  return child
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("fetchBenefitPolicyUpdatesFromAnalysisService", () => {
  it("posts benefit names to the analysis service with auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ok: true,
        findings: [],
        fetch_failures: [],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchBenefitPolicyUpdatesFromAnalysisService(
      { benefitNames: ["Health Safety Net"], includeUnchanged: true },
      { baseUrl: "http://analysis.test", apiToken: "token-1", userId: "user-1" },
    )

    expect(fetchMock).toHaveBeenCalledWith(
      "http://analysis.test/masshealth/benefit-policy-updates",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "user-id": "user-1",
        }),
        body: JSON.stringify({ benefitNames: ["Health Safety Net"], includeUnchanged: true }),
      }),
    )
    expect(result.source).toBe("analysis-service")
  })

  it("throws when the analysis service returns a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    await expect(
      fetchBenefitPolicyUpdatesFromAnalysisService({ benefitNames: ["Pharmacy"] }),
    ).rejects.toThrow("Analysis service returned 503")
  })
})

describe("fetchBenefitPolicyUpdatesFromLocalPython", () => {
  it("runs the local integration CLI and parses JSON stdout", async () => {
    const child = makeChild()
    spawnMock.mockReturnValue(child)

    const promise = fetchBenefitPolicyUpdatesFromLocalPython({
      benefitNames: ["Dental Benefits"],
      includeUnchanged: true,
    })

    expect(child.stdin.end).toHaveBeenCalledWith(
      JSON.stringify({
        benefitNames: ["Dental Benefits"],
        includeUnchanged: true,
        configPath: "/Users/blee/dev/tinyfish/masshealth_sources.json",
        snapshotPath: "/Users/blee/dev/tinyfish/.tinyfish/mhealth-app-policy-snapshots.json",
      }),
    )

    child.stdout.emit("data", JSON.stringify({ ok: true, findings: [], fetch_failures: [] }))
    child.emit("close", 0)

    await expect(promise).resolves.toMatchObject({
      ok: true,
      source: "local-python",
      degraded: true,
    })
  })

  it("rejects with stderr when the local integration CLI fails", async () => {
    const child = makeChild()
    spawnMock.mockReturnValue(child)

    const promise = fetchBenefitPolicyUpdatesFromLocalPython({ benefitNames: ["Pharmacy"] })
    child.stderr.emit("data", "python failed")
    child.emit("close", 1)

    await expect(promise).rejects.toThrow("python failed")
  })
})
