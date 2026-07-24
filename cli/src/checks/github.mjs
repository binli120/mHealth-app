import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const UNAVAILABLE_PATTERN = /not logged into|authentication required|http 401|command not found|enoent/i

export function deriveChecksStatus(rollup) {
  if (!rollup || rollup.length === 0) return "NONE"
  if (rollup.some((c) => c.conclusion === "FAILURE" || c.conclusion === "TIMED_OUT" || c.conclusion === "CANCELLED")) {
    return "FAILURE"
  }
  if (rollup.some((c) => !c.conclusion || c.status === "IN_PROGRESS" || c.status === "QUEUED")) {
    return "PENDING"
  }
  return "SUCCESS"
}

export function classifyGithubStatus({ mainRun, prs, unmergedBranchCount, mainBranch = "main" }) {
  const parts = []

  let mainStatus = "pass"
  if (!mainRun) {
    parts.push(`${mainBranch} CI: no runs found`)
  } else if (mainRun.status !== "completed") {
    mainStatus = "warn"
    parts.push(`${mainBranch} CI: ${mainRun.status}`)
  } else if (mainRun.conclusion !== "success") {
    mainStatus = "fail"
    parts.push(`${mainBranch} CI: ${mainRun.conclusion}`)
  } else {
    parts.push(`${mainBranch} CI: passing`)
  }

  const conflicting = prs.filter((pr) => pr.mergeable === "CONFLICTING")
  const failingChecks = prs.filter((pr) => pr.checksStatus === "FAILURE")
  const changesRequested = prs.filter((pr) => pr.reviewDecision === "CHANGES_REQUESTED")

  const prStatus = conflicting.length > 0 || failingChecks.length > 0 || changesRequested.length > 0 ? "warn" : "pass"

  let prSummary = `open PRs: ${prs.length}`
  if (conflicting.length) prSummary += `, ${conflicting.length} conflicting`
  if (failingChecks.length) prSummary += `, ${failingChecks.length} failing checks`
  if (changesRequested.length) prSummary += `, ${changesRequested.length} changes requested`
  parts.push(prSummary)

  parts.push(`local branches not merged into ${mainBranch}: ${unmergedBranchCount}`)

  const status = mainStatus === "fail" ? "fail" : mainStatus === "warn" || prStatus === "warn" ? "warn" : "pass"

  return { status, detail: parts.join(" | ") }
}

async function ghJson(args, timeoutMs) {
  const { stdout } = await execFileAsync("gh", args, { timeout: timeoutMs })
  return JSON.parse(stdout)
}

export async function checkGithub({ repoRoot, timeoutMs = 8000, mainBranch = "main" } = {}) {
  const start = Date.now()

  try {
    const [runs, prs] = await Promise.all([
      ghJson(["run", "list", "--branch", mainBranch, "--limit", "1", "--json", "status,conclusion,url,workflowName"], timeoutMs),
      ghJson(["pr", "list", "--json", "number,title,mergeable,reviewDecision,statusCheckRollup,headRefName", "--limit", "100"], timeoutMs),
    ])

    const mainRun = runs[0] ?? null
    const prsWithChecks = prs.map((pr) => ({ ...pr, checksStatus: deriveChecksStatus(pr.statusCheckRollup) }))

    let unmergedBranchCount = 0
    try {
      const { stdout } = await execFileAsync("git", ["-C", repoRoot, "branch", "--no-merged", `origin/${mainBranch}`], {
        timeout: timeoutMs,
      })
      unmergedBranchCount = stdout.split("\n").filter((line) => line.trim().length > 0).length
    } catch {
      // no origin/<mainBranch> ref locally, or git failure — non-fatal, report 0
    }

    const { status, detail } = classifyGithubStatus({ mainRun, prs: prsWithChecks, unmergedBranchCount, mainBranch })
    return { name: "github", status, detail, durationMs: Date.now() - start }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (UNAVAILABLE_PATTERN.test(message)) {
      return {
        name: "github",
        status: "skip",
        detail: `gh CLI not available or not authenticated — run "gh auth login" (${message})`,
        durationMs: Date.now() - start,
      }
    }
    return { name: "github", status: "fail", detail: message, durationMs: Date.now() - start }
  }
}
