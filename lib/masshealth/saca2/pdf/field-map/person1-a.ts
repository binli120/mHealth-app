/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FieldEntry } from "../types"

/**
 * Person 1 fields on form pages 1-3 that have no Person 2 counterpart in the shared person table
 * (Person 2's own block holds no equivalent).
 */
export const PERSON1_A_ENTRIES: FieldEntry[] = [
  {
    fields: ["19. # of people listed on the application"],
    source: { kind: "derived", id: "application.peopleListed" },
    encode: "number",
  },
]
