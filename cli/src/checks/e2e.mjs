import { runSpawnCheck } from "./_spawn.mjs"

export function checkE2e({ quiet } = {}) {
  return runSpawnCheck("e2e", "pnpm", ["test:e2e"], { quiet })
}
