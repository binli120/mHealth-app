# mh — HealthCompass health-check CLI

Runs every health check for this project from one command: lint, unit
tests, build, e2e, VPS/container health, the public app/api/mcp/
openobserve/edge-TLS endpoints, and GitHub repo health (main CI, open
PRs, unmerged local branches).

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
--openobserve --edge --github`. Passing none runs all of them, in that order.

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

## GitHub check

The `--github` category shells out to the `gh` CLI, so it needs `gh` installed
and authenticated (`gh auth login`) — if not, `mh check` marks `github` as
`skip`. It reports three things in one check: the latest CI run status on
`main`, open PRs (merge conflicts, failing checks, changes-requested
reviews), and how many local branches aren't merged into `origin/main` yet.
It's `fail` only if the latest `main` CI run failed; open-PR issues and
unmerged branches are `warn` — informational, not a red flag on their own.
