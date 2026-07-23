import { runSpawnCheck } from "./_spawn.mjs"

export function checkBuild({ quiet } = {}) {
  return runSpawnCheck("build", "pnpm", ["build"], { quiet })
}
