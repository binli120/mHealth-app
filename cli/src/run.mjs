import { parseArgs } from "node:util"

import { checkApp } from "./checks/app.mjs"
import { checkBuild } from "./checks/build.mjs"
import { checkDb } from "./checks/db.mjs"
import { checkE2e } from "./checks/e2e.mjs"
import { checkEdge } from "./checks/edge.mjs"
import { checkGithub } from "./checks/github.mjs"
import { checkLint } from "./checks/lint.mjs"
import { checkMcp } from "./checks/mcp.mjs"
import { checkOpenobserve } from "./checks/openobserve.mjs"
import { checkTest } from "./checks/test.mjs"
import { checkVps } from "./checks/vps.mjs"
import { deriveExitCode, formatJson, formatTable } from "./summary.mjs"
import { getVersionInfo, resolveRepoRoot, updateSelf } from "./update.mjs"

export const ALL_CATEGORIES = ["lint", "test", "build", "e2e", "vps", "app", "db", "mcp", "openobserve", "edge", "github"]
const COMMANDS = new Set(["check", "update", "version"])

const RUNNERS = {
  lint: (opts) => checkLint({ quiet: opts.quiet, repoRoot: opts.repoRoot }),
  test: (opts) => checkTest({ quiet: opts.quiet, repoRoot: opts.repoRoot }),
  build: (opts) => checkBuild({ quiet: opts.quiet, repoRoot: opts.repoRoot }),
  e2e: (opts) => checkE2e({ quiet: opts.quiet, repoRoot: opts.repoRoot }),
  vps: (opts) => checkVps({ repoRoot: opts.repoRoot, timeoutMs: opts.timeoutMs }),
  app: (opts) => checkApp({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  db: (opts) => checkDb({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  mcp: (opts) => checkMcp({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  openobserve: (opts) => checkOpenobserve({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  edge: (opts) => checkEdge({ domain: opts.domain, timeoutMs: opts.timeoutMs }),
  github: (opts) => checkGithub({ repoRoot: opts.repoRoot, timeoutMs: opts.timeoutMs }),
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
    help: { type: "boolean", short: "h", default: false },
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

  const timeoutMs = values.timeout ? Number(values.timeout) : 8000
  if (!Number.isFinite(timeoutMs)) {
    throw new Error(`invalid arguments: --timeout must be a number, got "${values.timeout}"`)
  }

  return {
    command,
    domain: values.domain || process.env.MH_DOMAIN || "healthcompass.cloud",
    timeoutMs,
    json: values.json,
    quiet: values.quiet,
    help: values.help,
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

  if (args.help) {
    const categoriesLine = ALL_CATEGORIES.map((category) => `--${category}`).join(" ")
    console.log(`Usage: mh [check] [category-flags] [options]
       mh update
       mh version

Runs all health checks by default. Pass one or more category flags to narrow the run.

Category flags (any combination; default is all of them):
  ${categoriesLine}

Options:
  --domain <host>    Override the target domain (default: healthcompass.cloud)
  --timeout <ms>     Network timeout in milliseconds (default: 8000)
  --json             Machine-readable output
  --quiet            Suppress live output from local checks
  --help, -h         Show this help

Examples:
  mh                       Run every check
  mh check --lint --test   Run only lint and unit tests`)
    return
  }

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
