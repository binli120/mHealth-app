/**
 * Reads vitest JSON output (test-results.json) and creates GitHub Issues
 * for every failing test suite and/or a coverage-threshold failure.
 *
 * Environment variables (all required in CI):
 *   GITHUB_TOKEN   — GITHUB_TOKEN from Actions
 *   GITHUB_REPO    — "owner/repo"  e.g. "binli120/mhealth-app"
 *   GITHUB_SHA     — full commit SHA
 *   GITHUB_REF     — ref string e.g. "refs/heads/main"
 *   GITHUB_RUN_ID  — Actions run ID
 *   GITHUB_SERVER_URL — e.g. "https://github.com"
 *   RESULTS_FILE   — path to test-results.json (default: "test-results.json")
 */

import { readFileSync } from "node:fs"
import { resolve }      from "node:path"

const {
  GITHUB_TOKEN,
  GITHUB_REPO,
  GITHUB_SHA     = "",
  GITHUB_REF     = "",
  GITHUB_RUN_ID  = "",
  GITHUB_SERVER_URL = "https://github.com",
  RESULTS_FILE   = "test-results.json",
} = process.env

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.error("Missing GITHUB_TOKEN or GITHUB_REPO")
  process.exit(1)
}

const [owner, repo] = GITHUB_REPO.split("/")
const short = GITHUB_SHA.slice(0, 7)
const runUrl = `${GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${GITHUB_RUN_ID}`

// ── GitHub REST helper ────────────────────────────────────────────────────────

async function ghPost(path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${GITHUB_TOKEN}`,
      Accept:         "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API ${res.status}: ${text}`)
  }
  return res.json()
}

async function createIssue({ title, labels, body }) {
  const issue = await ghPost(`/repos/${owner}/${repo}/issues`, { title, labels, body })
  console.log(`Issue created: ${issue.html_url}`)
  return issue
}

// ── Parse results ─────────────────────────────────────────────────────────────

let results
try {
  results = JSON.parse(readFileSync(resolve(RESULTS_FILE), "utf8"))
} catch {
  // If the file doesn't exist the test runner itself likely crashed.
  await createIssue({
    title:  `[CI] Test runner crashed — ${short}`,
    labels: ["bug", "ci-failure"],
    body: [
      "## CI Test Runner Crash",
      "",
      `**Commit:** ${GITHUB_SHA}`,
      `**Branch:** ${GITHUB_REF}`,
      `**Run:** ${runUrl}`,
      "",
      "`test-results.json` was not produced. The test runner may have crashed or hit an OOM.",
      "Check the raw CI logs for details.",
    ].join("\n"),
  })
  process.exit(1)
}

// ── Collect failures ──────────────────────────────────────────────────────────

const failedSuites = []
for (const file of results.testResults ?? []) {
  const failedTests = (file.assertionResults ?? []).filter(t => t.status === "failed")
  if (failedTests.length > 0) {
    failedSuites.push({ file: file.testFilePath, tests: failedTests })
  }
}

let hasErrors = false

// ── Coverage threshold failure (no individual test failures) ─────────────────

if (failedSuites.length === 0) {
  console.log("No individual test failures. Checking whether this is a coverage issue…")
  await createIssue({
    title:  `[CI] Coverage below 90% threshold — ${short}`,
    labels: ["bug", "test-coverage", "ci-failure"],
    body: [
      "## Coverage Threshold Failure",
      "",
      `**Commit:** ${GITHUB_SHA}`,
      `**Branch:** ${GITHUB_REF}`,
      `**Run:** ${runUrl}`,
      "",
      "All tests passed but overall coverage dropped below the **90 %** threshold",
      "configured in `vitest.config.ts` (lines · functions · branches · statements).",
      "",
      "### Action Required",
      `- Download the **coverage-report** artifact from the [CI run](${runUrl}).`,
      "- Open `coverage/index.html` locally to see which files need more tests.",
      "- Add tests for uncovered branches/functions until all four metrics reach ≥ 90 %.",
      "- See `TEST_PLAN.md` for the prioritised list of modules still needing tests.",
    ].join("\n"),
  })
  hasErrors = true
}

// ── Per-suite failure issues ──────────────────────────────────────────────────

for (const suite of failedSuites) {
  const shortFile = suite.file.replace(process.cwd() + "/", "")
  const failList = suite.tests
    .map(t => {
      const msg = (t.failureMessages ?? []).join("\n").slice(0, 600)
      return `- **${t.fullName ?? t.title}**\n  \`\`\`\n  ${msg}\n  \`\`\``
    })
    .join("\n")

  await createIssue({
    title:  `[CI] Test failure: ${shortFile} — ${short}`,
    labels: ["bug", "test-failure", "ci-failure"],
    body: [
      "## Test Failures Detected in CI",
      "",
      `**File:** \`${shortFile}\``,
      `**Commit:** ${GITHUB_SHA}`,
      `**Branch:** ${GITHUB_REF}`,
      `**Run:** ${runUrl}`,
      "",
      "### Failed Tests",
      failList,
      "",
      "### Reproduce Locally",
      "```bash",
      `pnpm test ${shortFile}`,
      "```",
      "",
      "_Auto-generated by CI test gate. Close once the failing tests pass on main._",
    ].join("\n"),
  })
  hasErrors = true
}

if (hasErrors) process.exit(1)
console.log("No failures — nothing to report.")
