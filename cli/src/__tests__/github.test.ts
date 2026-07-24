import { describe, expect, it } from "vitest"
import { classifyGithubStatus, deriveChecksStatus } from "../checks/github.mjs"

describe("deriveChecksStatus", () => {
  it("returns NONE for an empty or missing rollup", () => {
    expect(deriveChecksStatus([])).toBe("NONE")
    expect(deriveChecksStatus(undefined)).toBe("NONE")
  })

  it("returns SUCCESS when every check concluded successfully", () => {
    expect(deriveChecksStatus([{ conclusion: "SUCCESS", status: "COMPLETED" }])).toBe("SUCCESS")
  })

  it("returns FAILURE when any check failed, cancelled, or timed out", () => {
    expect(deriveChecksStatus([{ conclusion: "SUCCESS" }, { conclusion: "FAILURE" }])).toBe("FAILURE")
    expect(deriveChecksStatus([{ conclusion: "CANCELLED" }])).toBe("FAILURE")
    expect(deriveChecksStatus([{ conclusion: "TIMED_OUT" }])).toBe("FAILURE")
  })

  it("returns PENDING when a check is still running or has no conclusion yet", () => {
    expect(deriveChecksStatus([{ conclusion: null, status: "IN_PROGRESS" }])).toBe("PENDING")
    expect(deriveChecksStatus([{ conclusion: null, status: "QUEUED" }])).toBe("PENDING")
  })
})

const passingRun = { status: "completed", conclusion: "success" }

describe("classifyGithubStatus", () => {
  it("passes when main CI is green, no PRs, no unmerged branches", () => {
    const result = classifyGithubStatus({ mainRun: passingRun, prs: [], unmergedBranchCount: 0 })
    expect(result.status).toBe("pass")
    expect(result.detail).toContain("main CI: passing")
    expect(result.detail).toContain("open PRs: 0")
    expect(result.detail).toContain("local branches not merged into main: 0")
  })

  it("fails when the latest main CI run concluded with failure", () => {
    const result = classifyGithubStatus({ mainRun: { status: "completed", conclusion: "failure" }, prs: [], unmergedBranchCount: 0 })
    expect(result.status).toBe("fail")
    expect(result.detail).toContain("main CI: failure")
  })

  it("warns when the latest main CI run is still in progress", () => {
    const result = classifyGithubStatus({ mainRun: { status: "in_progress", conclusion: null }, prs: [], unmergedBranchCount: 0 })
    expect(result.status).toBe("warn")
    expect(result.detail).toContain("main CI: in_progress")
  })

  it("reports no runs found without failing when mainRun is null", () => {
    const result = classifyGithubStatus({ mainRun: null, prs: [], unmergedBranchCount: 0 })
    expect(result.status).toBe("pass")
    expect(result.detail).toContain("main CI: no runs found")
  })

  it("warns when an open PR has merge conflicts", () => {
    const prs = [{ mergeable: "CONFLICTING", checksStatus: "SUCCESS", reviewDecision: "" }]
    const result = classifyGithubStatus({ mainRun: passingRun, prs, unmergedBranchCount: 0 })
    expect(result.status).toBe("warn")
    expect(result.detail).toContain("1 conflicting")
  })

  it("warns when an open PR has failing checks", () => {
    const prs = [{ mergeable: "MERGEABLE", checksStatus: "FAILURE", reviewDecision: "" }]
    const result = classifyGithubStatus({ mainRun: passingRun, prs, unmergedBranchCount: 0 })
    expect(result.status).toBe("warn")
    expect(result.detail).toContain("1 failing checks")
  })

  it("warns when an open PR has changes requested", () => {
    const prs = [{ mergeable: "MERGEABLE", checksStatus: "SUCCESS", reviewDecision: "CHANGES_REQUESTED" }]
    const result = classifyGithubStatus({ mainRun: passingRun, prs, unmergedBranchCount: 0 })
    expect(result.status).toBe("warn")
    expect(result.detail).toContain("1 changes requested")
  })

  it("fails (not warns) when main CI failure coincides with a PR conflict", () => {
    const prs = [{ mergeable: "CONFLICTING", checksStatus: "SUCCESS", reviewDecision: "" }]
    const result = classifyGithubStatus({ mainRun: { status: "completed", conclusion: "failure" }, prs, unmergedBranchCount: 0 })
    expect(result.status).toBe("fail")
  })

  it("includes the unmerged branch count in the detail without affecting status", () => {
    const result = classifyGithubStatus({ mainRun: passingRun, prs: [], unmergedBranchCount: 7 })
    expect(result.status).toBe("pass")
    expect(result.detail).toContain("local branches not merged into main: 7")
  })
})
