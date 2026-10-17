/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { getInventory } from "./inventory"
import { NEVER_FILL } from "./never-fill"
import type { FieldEntry } from "./types"

/** Inventory names that are neither mapped nor deliberately never filled, sorted. */
export function computeUnmappedFields(map: FieldEntry[], neverFill: Record<string, unknown> = NEVER_FILL): string[] {
  const covered = new Set<string>([...map.flatMap((e) => e.fields), ...Object.keys(neverFill)])
  return getInventory()
    .map((f) => f.name)
    .filter((name) => !covered.has(name))
    .sort()
}
