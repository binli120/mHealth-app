# `mh` Health CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a globally-installable `mh` CLI that runs every health check for this project (lint, unit tests, build, e2e, VPS/container health, public app/api/mcp/openobserve endpoints, edge TLS) from one command, with category flags to narrow the run and a `mh update` self-update.

**Architecture:** A standalone zero-dependency ESM package at `cli/`, linked onto PATH via `npm link`. Each health-check category is an isolated module exporting an async function that returns a `CheckResult`; a thin orchestrator (`run.mjs`) sequences the selected categories and renders a final summary. Every category's *decision logic* (exit-code mapping, cert-expiry threshold, SSH-failure classification, HTTP-status classification) is factored into a pure, synchronous function so it can be unit-tested without touching the network, a child process, or the filesystem.

**Tech Stack:** Node.js built-ins only (`node:util` `parseArgs`, `node:child_process`, `node:tls`, `node:fs`, `node:url`, global `fetch`). Tests via the repo's existing root Vitest config (no separate test runner/config for `cli/`).

## Global Constraints

- No new npm dependencies — `cli/package.json` has no `dependencies` field.
- No build step — every file under `cli/` is directly executable/importable ESM (`"type": "module"`).
- `cli/src/__tests__/*.test.ts` run via the repo's existing root `vitest.config.ts` (already un-excluded — only `node_modules`, `dist`, `.next`, `.claude`, `e2e` are excluded) — do not add a separate Vitest config.
- Default domain: `healthcompass.cloud` (override via `--domain` flag or `MH_DOMAIN` env var).
- SSH VPS alias name is always `healthcompass-vps` — never hardcode the VPS IP (`72.60.29.200`) or any credential inside `cli/` code; it only appears in the `~/.ssh/config` example in `cli/README.md`.
- `CheckResult` shape, used everywhere: `{ name: string, status: "pass" | "warn" | "fail" | "skip", detail: string, durationMs: number }`.
- Category run order is fixed: `lint, test, build, e2e, vps, app, db, mcp, openobserve, edge`.
- Exit code: `1` if any `CheckResult.status === "fail"`, else `0`. `skip` and `warn` never cause a non-zero exit on their own.

---

### Task 1: Scaffold `cli/` package + summary rendering

**Files:**
- Create: `cli/package.json`
- Create: `cli/src/summary.mjs`
- Create: `cli/src/__tests__/summary.test.ts`

**Interfaces:**
- Produces: `deriveExitCode(results: CheckResult[]): 0 | 1`, `summaryLabel(results: CheckResult[]): "healthy" | "warn" | "degraded"`, `formatTable(results: CheckResult[]): string`, `formatJson(results: CheckResult[]): string` — all consumed by Task 7's `run.mjs`.

- [ ] **Step 1: Create the package scaffold**

```bash
mkdir -p cli/src/checks cli/src/__tests__
```

Create `cli/package.json`:

```json
{
  "name": "mh-cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "mh": "./bin/mh.mjs"
  }
}
```

- [ ] **Step 2: Write the failing test for summary rendering**

Create `cli/src/__tests__/summary.test.ts`:

```ts
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
```

- [ ] **Step 2b: Run it and confirm it fails**

Run: `pnpm vitest run cli/src/__tests__/summary.test.ts`
Expected: FAIL — `Cannot find module '../summary.mjs'`

- [ ] **Step 3: Implement `summary.mjs`**

Create `cli/src/summary.mjs`:

```js
const ICONS = { pass: "✓", warn: "⚠", fail: "✗", skip: "⏭" }

export function deriveExitCode(results) {
  return results.some((r) => r.status === "fail") ? 1 : 0
}

export function summaryLabel(results) {
  if (results.some((r) => r.status === "fail")) return "degraded"
  if (results.some((r) => r.status === "warn")) return "warn"
  return "healthy"
}

export function formatTable(results) {
  const lines = results.map((r) => {
    const icon = ICONS[r.status] ?? "?"
    const name = r.name.padEnd(14)
    const status = r.status.toUpperCase().padEnd(5)
    return `  ${icon}  ${name} ${status} — ${r.detail} (${r.durationMs}ms)`
  })
  lines.push("")
  lines.push(`Summary: ${summaryLabel(results)}`)
  return lines.join("\n")
}

export function formatJson(results) {
  return JSON.stringify(
    { ok: deriveExitCode(results) === 0, summary: summaryLabel(results), results },
    null,
    2,
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run cli/src/__tests__/summary.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add cli/package.json cli/src/summary.mjs cli/src/__tests__/summary.test.ts
git commit -m "mh-cli: scaffold package + summary rendering"
```

---

### Task 2: Self-update primitives (`update.mjs`)

**Files:**
- Create: `cli/src/update.mjs`
- Create: `cli/src/__tests__/update.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `resolveRepoRoot(fileUrl: string): string`, `getVersionInfo(repoRoot: string): Promise<{ version: string, sha: string }>`, `updateSelf({ repoRoot: string }): Promise<{ ok: boolean, message: string }>` — all consumed by Task 7's `run.mjs`.

- [ ] **Step 1: Write the failing test for `resolveRepoRoot`**

Create `cli/src/__tests__/update.test.ts`:

```ts
import path from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { resolveRepoRoot } from "../update.mjs"

describe("resolveRepoRoot", () => {
  it("resolves two directories up from the given file url", () => {
    const fakeFileUrl = pathToFileURL("/repo/cli/src/run.mjs").href
    const root = resolveRepoRoot(fakeFileUrl)
    expect(path.normalize(root)).toBe(path.normalize("/repo/"))
  })

  it("works the same for a file under cli/bin", () => {
    const fakeFileUrl = pathToFileURL("/repo/cli/bin/mh.mjs").href
    const root = resolveRepoRoot(fakeFileUrl)
    expect(path.normalize(root)).toBe(path.normalize("/repo/"))
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run cli/src/__tests__/update.test.ts`
Expected: FAIL — `Cannot find module '../update.mjs'`

- [ ] **Step 3: Implement `update.mjs`**

Create `cli/src/update.mjs`:

```js
import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export function resolveRepoRoot(fileUrl) {
  return fileURLToPath(new URL("../../", fileUrl))
}

export async function getVersionInfo(repoRoot) {
  const pkgPath = path.join(repoRoot, "cli", "package.json")
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))

  let sha = "unknown"
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "--short", "HEAD"])
    sha = stdout.trim()
  } catch {
    // not a git checkout, or git unavailable — version alone is still useful
  }

  return { version: pkg.version, sha }
}

export async function updateSelf({ repoRoot }) {
  try {
    const before = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "--short", "HEAD"])
    await execFileAsync("git", ["-C", repoRoot, "fetch"])
    await execFileAsync("git", ["-C", repoRoot, "pull", "--ff-only"])
    const after = await execFileAsync("git", ["-C", repoRoot, "rev-parse", "--short", "HEAD"])

    const beforeSha = before.stdout.trim()
    const afterSha = after.stdout.trim()
    const message =
      beforeSha === afterSha
        ? `already up to date (${afterSha})`
        : `updated ${beforeSha} → ${afterSha}`

    return { ok: true, message }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `update failed: ${message}` }
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run cli/src/__tests__/update.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add cli/src/update.mjs cli/src/__tests__/update.test.ts
git commit -m "mh-cli: add self-update primitives"
```

---

### Task 3: Local process checks (lint, test, build, e2e)

**Files:**
- Create: `cli/src/checks/_spawn.mjs`
- Create: `cli/src/checks/lint.mjs`
- Create: `cli/src/checks/test.mjs`
- Create: `cli/src/checks/build.mjs`
- Create: `cli/src/checks/e2e.mjs`
- Create: `cli/src/__tests__/spawn.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `checkLint({ quiet }): Promise<CheckResult>`, `checkTest({ quiet }): Promise<CheckResult>`, `checkBuild({ quiet }): Promise<CheckResult>`, `checkE2e({ quiet }): Promise<CheckResult>` — all consumed by Task 7's `run.mjs`.

- [ ] **Step 1: Write the failing test for the pure exit-code mapping**

Create `cli/src/__tests__/spawn.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { exitCodeToStatus } from "../checks/_spawn.mjs"

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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run cli/src/__tests__/spawn.test.ts`
Expected: FAIL — `Cannot find module '../checks/_spawn.mjs'`

- [ ] **Step 3: Implement `_spawn.mjs` and the four local checks**

Create `cli/src/checks/_spawn.mjs`:

```js
import { spawn } from "node:child_process"

export function exitCodeToStatus(code) {
  return code === 0 ? "pass" : "fail"
}

export function runSpawnCheck(name, command, args, { quiet = false } = {}) {
  const start = Date.now()
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: quiet ? "ignore" : "inherit",
      shell: false,
    })

    child.on("error", (err) => {
      resolve({
        name,
        status: "fail",
        detail: `failed to start: ${err.message}`,
        durationMs: Date.now() - start,
      })
    })

    child.on("close", (code) => {
      resolve({
        name,
        status: exitCodeToStatus(code),
        detail: code === 0 ? "exited 0" : `exited ${code}`,
        durationMs: Date.now() - start,
      })
    })
  })
}
```

Create `cli/src/checks/lint.mjs`:

```js
import { runSpawnCheck } from "./_spawn.mjs"

export function checkLint({ quiet } = {}) {
  return runSpawnCheck("lint", "pnpm", ["lint"], { quiet })
}
```

Create `cli/src/checks/test.mjs`:

```js
import { runSpawnCheck } from "./_spawn.mjs"

export function checkTest({ quiet } = {}) {
  return runSpawnCheck("test", "pnpm", ["test:ci"], { quiet })
}
```

Create `cli/src/checks/build.mjs`:

```js
import { runSpawnCheck } from "./_spawn.mjs"

export function checkBuild({ quiet } = {}) {
  return runSpawnCheck("build", "pnpm", ["build"], { quiet })
}
```

Create `cli/src/checks/e2e.mjs`:

```js
import { runSpawnCheck } from "./_spawn.mjs"

export function checkE2e({ quiet } = {}) {
  return runSpawnCheck("e2e", "pnpm", ["test:e2e"], { quiet })
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run cli/src/__tests__/spawn.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add cli/src/checks/_spawn.mjs cli/src/checks/lint.mjs cli/src/checks/test.mjs cli/src/checks/build.mjs cli/src/checks/e2e.mjs cli/src/__tests__/spawn.test.ts
git commit -m "mh-cli: add local process checks (lint/test/build/e2e)"
```

---

### Task 4: Remote HTTP checks (app, db, mcp, openobserve)

**Files:**
- Create: `cli/src/checks/_http.mjs`
- Create: `cli/src/checks/app.mjs`
- Create: `cli/src/checks/db.mjs`
- Create: `cli/src/checks/mcp.mjs`
- Create: `cli/src/checks/openobserve.mjs`
- Create: `cli/src/__tests__/http.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `checkApp({ domain, timeoutMs }): Promise<CheckResult>`, `checkDb({ domain, timeoutMs }): Promise<CheckResult>`, `checkMcp({ domain, timeoutMs }): Promise<CheckResult>`, `checkOpenobserve({ domain, timeoutMs }): Promise<CheckResult>` — all consumed by Task 7's `run.mjs`.

- [ ] **Step 1: Write the failing test for the pure HTTP-result classifier**

Create `cli/src/__tests__/http.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run cli/src/__tests__/http.test.ts`
Expected: FAIL — `Cannot find module '../checks/_http.mjs'`

- [ ] **Step 3: Implement `_http.mjs` and the four remote checks**

Create `cli/src/checks/_http.mjs`:

```js
export function classifyHttpResult({ name, elapsedMs, response, error, expectedStatuses = [200] }) {
  if (error) {
    return { name, status: "fail", detail: `request failed: ${error.message}`, durationMs: elapsedMs }
  }
  if (expectedStatuses.includes(response.status)) {
    return { name, status: "pass", detail: `HTTP ${response.status}`, durationMs: elapsedMs }
  }
  return { name, status: "fail", detail: `unexpected HTTP ${response.status}`, durationMs: elapsedMs }
}

export async function runHttpCheck(name, url, { timeoutMs = 8000, expectedStatuses = [200] } = {}) {
  const start = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return classifyHttpResult({ name, elapsedMs: Date.now() - start, response, error: null, expectedStatuses })
  } catch (error) {
    return classifyHttpResult({ name, elapsedMs: Date.now() - start, response: null, error, expectedStatuses })
  }
}
```

Create `cli/src/checks/app.mjs`:

```js
import { runHttpCheck } from "./_http.mjs"

export function checkApp({ domain, timeoutMs }) {
  return runHttpCheck("app", `https://${domain}/api/health`, { timeoutMs })
}
```

Create `cli/src/checks/db.mjs`:

```js
import { runHttpCheck } from "./_http.mjs"

export function checkDb({ domain, timeoutMs }) {
  return runHttpCheck("db", `https://${domain}/api/health/db`, { timeoutMs })
}
```

Create `cli/src/checks/mcp.mjs`:

```js
import { runHttpCheck } from "./_http.mjs"

export function checkMcp({ domain, timeoutMs }) {
  return runHttpCheck("mcp", `https://${domain}/.well-known/oauth-authorization-server`, { timeoutMs })
}
```

Create `cli/src/checks/openobserve.mjs`:

```js
import { runHttpCheck } from "./_http.mjs"

export function checkOpenobserve({ domain, timeoutMs }) {
  return runHttpCheck("openobserve", `https://observe.${domain}/healthz`, { timeoutMs })
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run cli/src/__tests__/http.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add cli/src/checks/_http.mjs cli/src/checks/app.mjs cli/src/checks/db.mjs cli/src/checks/mcp.mjs cli/src/checks/openobserve.mjs cli/src/__tests__/http.test.ts
git commit -m "mh-cli: add remote HTTP checks (app/db/mcp/openobserve)"
```

---

### Task 5: Edge/TLS certificate check

**Files:**
- Create: `cli/src/checks/edge.mjs`
- Create: `cli/src/__tests__/edge.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `checkEdge({ domain, timeoutMs }): Promise<CheckResult>` — consumed by Task 7's `run.mjs`.

- [ ] **Step 1: Write the failing test for the pure cert-expiry threshold**

Create `cli/src/__tests__/edge.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { certStatus } from "../checks/edge.mjs"

describe("certStatus", () => {
  const now = new Date("2026-07-23T00:00:00Z")

  it("passes when expiry is well beyond the warn window", () => {
    const validTo = new Date("2026-09-01T00:00:00Z")
    expect(certStatus(validTo, now, 14)).toBe("pass")
  })

  it("warns when expiry is inside the warn window", () => {
    const validTo = new Date("2026-07-30T00:00:00Z")
    expect(certStatus(validTo, now, 14)).toBe("warn")
  })

  it("fails when the certificate has already expired", () => {
    const validTo = new Date("2026-07-01T00:00:00Z")
    expect(certStatus(validTo, now, 14)).toBe("fail")
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run cli/src/__tests__/edge.test.ts`
Expected: FAIL — `Cannot find module '../checks/edge.mjs'`

- [ ] **Step 3: Implement `edge.mjs`**

Create `cli/src/checks/edge.mjs`:

```js
import tls from "node:tls"

export function certStatus(validTo, now = new Date(), warnDays = 14) {
  const msRemaining = validTo.getTime() - now.getTime()
  if (msRemaining <= 0) return "fail"
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24)
  return daysRemaining < warnDays ? "warn" : "pass"
}

export function checkEdge({ domain, timeoutMs = 8000 }) {
  const start = Date.now()
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: domain, port: 443, servername: domain, timeout: timeoutMs },
      () => {
        const cert = socket.getPeerCertificate()
        socket.end()

        if (!cert || !cert.valid_to) {
          resolve({ name: "edge", status: "fail", detail: "no certificate returned", durationMs: Date.now() - start })
          return
        }

        const validTo = new Date(cert.valid_to)
        const status = certStatus(validTo, new Date())
        const daysLeft = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        resolve({
          name: "edge",
          status,
          detail: `cert valid to ${cert.valid_to} (${daysLeft}d remaining)`,
          durationMs: Date.now() - start,
        })
      },
    )

    socket.on("timeout", () => {
      socket.destroy()
      resolve({ name: "edge", status: "fail", detail: "TLS connect timed out", durationMs: Date.now() - start })
    })

    socket.on("error", (err) => {
      resolve({ name: "edge", status: "fail", detail: `TLS connect failed: ${err.message}`, durationMs: Date.now() - start })
    })
  })
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run cli/src/__tests__/edge.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add cli/src/checks/edge.mjs cli/src/__tests__/edge.test.ts
git commit -m "mh-cli: add edge/TLS certificate check"
```

---

### Task 6: VPS SSH check

**Files:**
- Create: `cli/src/checks/vps.mjs`
- Create: `cli/src/__tests__/vps.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (reads `deploy/check-services.sh` from `repoRoot` at runtime — that file already exists).
- Produces: `checkVps({ repoRoot, timeoutMs }): Promise<CheckResult>` — consumed by Task 7's `run.mjs`.

- [ ] **Step 1: Write the failing test for the pure SSH-result classifier**

Create `cli/src/__tests__/vps.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run cli/src/__tests__/vps.test.ts`
Expected: FAIL — `Cannot find module '../checks/vps.mjs'`

- [ ] **Step 3: Implement `vps.mjs`**

Create `cli/src/checks/vps.mjs`:

```js
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const SSH_ALIAS = "healthcompass-vps"
const UNREACHABLE_PATTERN = /could not resolve hostname|could not resolve|connection refused|connection timed out|permission denied \(publickey/i

export function classifySshExit({ code, stderr, durationMs }) {
  if (code !== 0 && UNREACHABLE_PATTERN.test(stderr)) {
    return {
      name: "vps",
      status: "skip",
      detail: `SSH alias "${SSH_ALIAS}" not reachable — add it to ~/.ssh/config (see cli/README.md)`,
      durationMs,
    }
  }
  if (code === 0) {
    return { name: "vps", status: "pass", detail: "all containers healthy", durationMs }
  }
  const tail = stderr.trim().split("\n").slice(-3).join(" | ") || "check-services.sh reported failures"
  return { name: "vps", status: "fail", detail: tail, durationMs }
}

export function checkVps({ repoRoot, timeoutMs = 15000 } = {}) {
  const start = Date.now()
  const scriptPath = path.join(repoRoot, "deploy", "check-services.sh")

  return new Promise((resolve) => {
    const child = spawn(
      "ssh",
      ["-o", "ConnectTimeout=8", "-o", "BatchMode=yes", SSH_ALIAS, "bash -s"],
      { stdio: [fs.createReadStream(scriptPath), "pipe", "pipe"] },
    )

    let stderr = ""
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.stdout.pipe(process.stdout)

    const timer = setTimeout(() => {
      child.kill()
      resolve({ name: "vps", status: "fail", detail: "ssh check timed out", durationMs: Date.now() - start })
    }, timeoutMs)

    child.on("close", (code) => {
      clearTimeout(timer)
      resolve(classifySshExit({ code, stderr, durationMs: Date.now() - start }))
    })
  })
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run cli/src/__tests__/vps.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add cli/src/checks/vps.mjs cli/src/__tests__/vps.test.ts
git commit -m "mh-cli: add VPS SSH health check"
```

---

### Task 7: Orchestrator, CLI entry point, and `npm link` install

**Files:**
- Create: `cli/src/run.mjs`
- Create: `cli/bin/mh.mjs`
- Create: `cli/src/__tests__/run.test.ts`

**Interfaces:**
- Consumes: `deriveExitCode`, `formatTable`, `formatJson` from `cli/src/summary.mjs` (Task 1); `resolveRepoRoot`, `getVersionInfo`, `updateSelf` from `cli/src/update.mjs` (Task 2); `checkLint`, `checkTest`, `checkBuild`, `checkE2e` from `cli/src/checks/{lint,test,build,e2e}.mjs` (Task 3); `checkApp`, `checkDb`, `checkMcp`, `checkOpenobserve` from `cli/src/checks/{app,db,mcp,openobserve}.mjs` (Task 4); `checkEdge` from `cli/src/checks/edge.mjs` (Task 5); `checkVps` from `cli/src/checks/vps.mjs` (Task 6).
- Produces: `ALL_CATEGORIES: string[]`, `parseCliArgs(argv: string[]): ParsedArgs`, `runChecks(categories: string[], opts): Promise<CheckResult[]>`, `main(argv: string[]): Promise<void>` — `main` is the sole export `bin/mh.mjs` calls.

- [ ] **Step 1: Write the failing test for `parseCliArgs`**

Create `cli/src/__tests__/run.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run cli/src/__tests__/run.test.ts`
Expected: FAIL — `Cannot find module '../run.mjs'`

- [ ] **Step 3: Implement `run.mjs`**

Create `cli/src/run.mjs`:

```js
import { parseArgs } from "node:util"

import { checkApp } from "./checks/app.mjs"
import { checkBuild } from "./checks/build.mjs"
import { checkDb } from "./checks/db.mjs"
import { checkE2e } from "./checks/e2e.mjs"
import { checkEdge } from "./checks/edge.mjs"
import { checkLint } from "./checks/lint.mjs"
import { checkMcp } from "./checks/mcp.mjs"
import { checkOpenobserve } from "./checks/openobserve.mjs"
import { checkTest } from "./checks/test.mjs"
import { checkVps } from "./checks/vps.mjs"
import { deriveExitCode, formatJson, formatTable } from "./summary.mjs"
import { getVersionInfo, resolveRepoRoot, updateSelf } from "./update.mjs"

export const ALL_CATEGORIES = ["lint", "test", "build", "e2e", "vps", "app", "db", "mcp", "openobserve", "edge"]
const COMMANDS = new Set(["check", "update", "version"])

const RUNNERS = {
  lint: (opts) => checkLint({ quiet: opts.quiet }),
  test: (opts) => checkTest({ quiet: opts.quiet }),
  build: (opts) => checkBuild({ quiet: opts.quiet }),
  e2e: (opts) => checkE2e({ quiet: opts.quiet }),
  vps: (opts) => checkVps({ repoRoot: opts.repoRoot, timeoutMs: opts.timeoutMs }),
  app: (opts) => checkApp({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  db: (opts) => checkDb({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  mcp: (opts) => checkMcp({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  openobserve: (opts) => checkOpenobserve({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  edge: (opts) => checkEdge({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
}

export function parseCliArgs(argv) {
  let command = "check"
  let rest = argv

  if (argv.length > 0 && COMMANDS.has(argv[0])) {
    command = argv[0]
    rest = argv.slice(1)
  }

  const optionsSpec = {
    domain: { type: "string" },
    timeout: { type: "string" },
    json: { type: "boolean", default: false },
    quiet: { type: "boolean", default: false },
  }
  for (const category of ALL_CATEGORIES) {
    optionsSpec[category] = { type: "boolean", default: false }
  }

  let values
  try {
    ;({ values } = parseArgs({ args: rest, options: optionsSpec, allowPositionals: false }))
  } catch (err) {
    throw new Error(`invalid arguments: ${err.message}`)
  }

  const selected = ALL_CATEGORIES.filter((category) => values[category] === true)

  return {
    command,
    domain: values.domain || process.env.MH_DOMAIN || "healthcompass.cloud",
    timeoutMs: values.timeout ? Number(values.timeout) : 8000,
    json: values.json,
    quiet: values.quiet,
    categories: selected.length > 0 ? selected : [...ALL_CATEGORIES],
  }
}

export async function runChecks(categories, opts) {
  const results = []
  for (const category of categories) {
    const start = Date.now()
    try {
      results.push(await RUNNERS[category](opts))
    } catch (err) {
      results.push({
        name: category,
        status: "fail",
        detail: `check crashed: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - start,
      })
    }
  }
  return results
}

export async function main(argv) {
  const args = parseCliArgs(argv)
  const repoRoot = resolveRepoRoot(import.meta.url)

  if (args.command === "version") {
    const { version, sha } = await getVersionInfo(repoRoot)
    console.log(`mh ${version} (${sha})`)
    return
  }

  if (args.command === "update") {
    const result = await updateSelf({ repoRoot })
    console.log(result.message)
    process.exitCode = result.ok ? 0 : 1
    return
  }

  const results = await runChecks(args.categories, { ...args, repoRoot })
  console.log(args.json ? formatJson(results) : formatTable(results))
  process.exitCode = deriveExitCode(results)
}
```

Create `cli/bin/mh.mjs`:

```js
#!/usr/bin/env node
import { main } from "../src/run.mjs"

main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
```

```bash
chmod +x cli/bin/mh.mjs
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run cli/src/__tests__/run.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Link the CLI globally and smoke-test it**

```bash
cd cli && npm link && cd ..
```

Run: `mh version`
Expected: prints `mh 0.1.0 (<short-sha>)`

Run: `mh check --lint`
Expected: runs `pnpm lint` live, then prints a one-row summary table ending in `Summary: healthy` (or `degraded` if lint currently has errors — either way, the command must exit and print a table, not crash)

- [ ] **Step 6: Commit**

```bash
git add cli/src/run.mjs cli/bin/mh.mjs cli/src/__tests__/run.test.ts
git commit -m "mh-cli: add orchestrator, CLI entry point, and npm link install"
```

---

### Task 8: Documentation

**Files:**
- Create: `cli/README.md`
- Modify: `README.md` (add a pointer row after the `## Commands` table, around line 279)

**Interfaces:**
- Consumes: nothing new — this task only documents the flags and commands already implemented in Tasks 1–7.
- Produces: nothing consumed by other tasks — this is the last task.

- [ ] **Step 1: Write `cli/README.md`**

Create `cli/README.md`:

```markdown
# mh — HealthCompass health-check CLI

Runs every health check for this project from one command: lint, unit
tests, build, e2e, VPS/container health, and the public app/api/mcp/
openobserve/edge-TLS endpoints.

## Install

    cd cli && npm link

This symlinks the global `mh` command back into this repo checkout. Because
it's a symlink, `mh update` (a `git pull` in this repo) takes effect
immediately — no relink needed.

## Usage

    mh                          # run every check (default)
    mh check --lint --test      # run only these categories
    mh check --domain other.example.com
    mh check --json             # machine-readable output
    mh update                   # git pull this repo checkout
    mh version                  # print CLI version + repo commit

Category flags: `--lint --test --build --e2e --vps --app --db --mcp
--openobserve --edge`. Passing none runs all of them, in that order.

## VPS check setup

The `--vps` category SSHes into the production VPS and runs
`deploy/check-services.sh` there. It expects a `healthcompass-vps` host
alias in your own `~/.ssh/config` — add one like this:

    Host healthcompass-vps
      HostName 72.60.29.200
      User <your-ssh-user>
      IdentityFile ~/.ssh/<your-key>

If the alias isn't configured, `mh check` marks `vps` as `skip` (not
`fail`) and prints this same instruction.
```

- [ ] **Step 2: Add a pointer in the main README**

In `README.md`, after the `## Commands` table (the row for `pnpm gen:test-license`, just before the `---` that precedes `## Local Service URLs`), add:

```markdown

> **Full health check:** see [`cli/README.md`](cli/README.md) for the `mh` CLI — one command for lint, tests, build, e2e, VPS/container health, and public endpoint checks.
```

- [ ] **Step 3: Commit**

```bash
git add cli/README.md README.md
git commit -m "mh-cli: add documentation"
```

---

## Self-review notes

- **Spec coverage:** every category in the spec's flag table (lint, test, build, e2e, vps, app, db, mcp, openobserve, edge) has a task and a `RUNNERS` entry; `mh update` and `mh version` are covered in Task 7; the `~/.ssh/config` setup note is covered in Task 8; the summary table/JSON output and exit-code rule are covered in Task 1.
- **Placeholder scan:** no TBD/TODO — every step has complete, runnable code.
- **Type/signature consistency:** `CheckResult` shape (`name/status/detail/durationMs`) is identical across every check module (Tasks 3–6) and consumed unchanged by `summary.mjs` (Task 1) and `run.mjs` (Task 7). Function names used in Task 7's imports (`checkLint`, `checkTest`, `checkBuild`, `checkE2e`, `checkApp`, `checkDb`, `checkMcp`, `checkOpenobserve`, `checkEdge`, `checkVps`, `deriveExitCode`, `formatJson`, `formatTable`, `resolveRepoRoot`, `getVersionInfo`, `updateSelf`) match the exports defined in Tasks 1–6 exactly.
