import { runSpawnCheck } from "./_spawn.mjs"

export function checkLint({ quiet, repoRoot } = {}) {
  return runSpawnCheck("lint", "pnpm", ["lint"], { quiet, cwd: repoRoot })
}
