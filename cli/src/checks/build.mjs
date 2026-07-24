import { runSpawnCheck } from "./_spawn.mjs"

export function checkBuild({ quiet, repoRoot } = {}) {
  return runSpawnCheck("build", "pnpm", ["build"], { quiet, cwd: repoRoot })
}
