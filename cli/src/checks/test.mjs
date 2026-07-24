import { runSpawnCheck } from "./_spawn.mjs"

export function checkTest({ quiet, repoRoot } = {}) {
  return runSpawnCheck("test", "pnpm", ["test:ci"], { quiet, cwd: repoRoot })
}
