import { runSpawnCheck } from "./_spawn.mjs"

export function checkTest({ quiet } = {}) {
  return runSpawnCheck("test", "pnpm", ["test:ci"], { quiet })
}
