import { runSpawnCheck } from "./_spawn.mjs"

export function checkLint({ quiet } = {}) {
  return runSpawnCheck("lint", "pnpm", ["lint"], { quiet })
}
