# `mh` Health CLI — Design

## Purpose

Consolidate scattered health checks (unit tests, lint, build, e2e, VPS/docker
containers, public app/api/mcp/openobserve endpoints, edge TLS) into one
installable, self-updating CLI. Replaces manually running `deploy/check-services.sh`
on the VPS plus separate `pnpm lint/test/build/test:e2e` invocations.

## Non-goals

- Not a CI replacement — GitHub Actions (`ci.yml`, `deploy.yml`) is unchanged.
- Not a monitoring/alerting system — no scheduling, no notifications. One-shot
  runs only.
- Does not manage secrets. SSH access comes from the user's own `~/.ssh/config`;
  the CLI never stores or reads credentials itself.

## Install / update model

Lives in-repo at `cli/`, a separate package:

```
cli/
  package.json        # name: "mh-cli", bin: { "mh": "./bin/mh.mjs" }
  bin/mh.mjs           # entry point, ESM, no build step
  src/
    run.mjs            # arg parsing (node:util parseArgs) + dispatch
    summary.mjs         # pass/warn/fail/skip table rendering
    checks/
      lint.mjs
      test.mjs
      build.mjs
      e2e.mjs
      vps.mjs
      app.mjs
      db.mjs
      mcp.mjs
      openobserve.mjs
      edge.mjs
    __tests__/
      summary.test.ts
      edge.test.ts
```

Install: `npm link` (or `pnpm link --global`) run from `cli/`. This creates a
global symlink back into the repo checkout — `mh` becomes available on PATH
everywhere, and since it's a symlink (not a copy), a `git pull` in the repo is
immediately live with no relink step.

Self-update (`mh update`):
1. Resolve repo root from the running script's own path (`import.meta.url` →
   walk up from `cli/bin/mh.mjs`).
2. `git -C <repoRoot> fetch && git -C <repoRoot> pull --ff-only`.
3. If `cli/package.json` or lockfile changed, re-run `pnpm install` inside `cli/`.
4. Print old → new short SHA and `cli/package.json` version.

No npm registry publishing — this is an internal tool tied to this repo
checkout, so "update" always means "update this checkout."

## Commands

- `mh` / `mh check [flags]` — run health checks (default command).
- `mh update` — self-update as above.
- `mh version` — prints CLI version + repo short SHA.

### Check flags

All categories run by default (bare `mh` = `mh check` = everything). Passing
any category flag(s) narrows the run to just those.

| Flag | Category | What it does |
|---|---|---|
| `--lint` | lint | `pnpm lint` |
| `--test` | unit tests | `pnpm test:ci` |
| `--build` | build | `pnpm build` |
| `--e2e` | e2e | `pnpm test:e2e` |
| `--vps` | VPS/containers | `ssh healthcompass-vps 'bash -s' < deploy/check-services.sh` |
| `--app` | app | `GET https://<domain>/api/health` |
| `--db` | db | `GET https://<domain>/api/health/db` |
| `--mcp` | mcp | `GET https://<domain>/.well-known/oauth-authorization-server` |
| `--openobserve` | openobserve | `GET https://observe.<domain>/healthz` |
| `--edge` | edge/TLS | TLS connect to `<domain>:443`, check cert expiry |

Other flags: `--domain <host>` (default `healthcompass.cloud`, or `MH_DOMAIN`
env), `--timeout <ms>` (default 8000, applies to all network checks),
`--json` (machine-readable summary instead of table), `--quiet` (suppress
live streaming of local-check stdout, show only final summary).

## Execution model

Each category is an independent async function:

```ts
type CheckResult = {
  name: string
  status: "pass" | "warn" | "fail" | "skip"
  detail: string
  durationMs: number
}
```

`run.mjs` runs the selected categories **sequentially** (not parallel) so
local-check output (lint/test/build/e2e) streams to the terminal in a
readable order, and so a slow VPS SSH check doesn't interleave with build
output. One category throwing/failing does not stop the rest — every
category always produces a `CheckResult`, even on crash (caught and turned
into `fail`).

Local checks (lint/test/build/e2e) spawn the existing `pnpm` scripts as
child processes, stream their stdout/stderr live, and turn the exit code
into pass/fail. Remote checks (app/db/mcp/openobserve) use `fetch` with
`AbortSignal.timeout`. Edge check uses `node:tls` to connect and read
`getPeerCertificate().valid_to`, warning if expiry is under 14 days.

The VPS check shells out to `ssh healthcompass-vps 'bash -s' < deploy/check-services.sh`.
If that SSH alias isn't configured (connection refused / resolution failure
within ~5s), the category is marked `skip` with a message pointing to the
`~/.ssh/config` snippet below — it does not count as a failure.

## Setup note (VPS SSH alias)

Documented in `cli/README.md`, not stored anywhere in code:

```
Host healthcompass-vps
  HostName 72.60.29.200
  User <ssh-user>
  IdentityFile ~/.ssh/<key>
```

## Output

Live-streamed output for local checks, followed by a final summary table in
the same visual style as `deploy/check-services.sh` (✓/✗/⚠ rows, colored).
Exit code: `0` if all categories are `pass` or `warn`, `1` if any `fail`
(`skip` doesn't affect exit code). `--json` emits `{ ok, summary, results: CheckResult[] }`
instead of the table, for future scripting.

## Testing

`cli/` gets its own small vitest suite (reusing the repo's existing vitest
setup) covering only pure logic — no network/process calls:
- `summary.test.ts` — table/JSON rendering, exit-code derivation from a set
  of `CheckResult`s.
- `edge.test.ts` — cert-expiry-to-status threshold logic (14-day warn cutoff).

No test coverage for the SSH/fetch/spawn glue itself — that's exercised by
actually running `mh check` against the real repo/VPS, not worth mocking.
