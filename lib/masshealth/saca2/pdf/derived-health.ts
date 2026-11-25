/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { householdHasSpouse } from "./derived-assets"
import type { DerivedRegistry } from "./pdf-fill"

/** Step 6: the form has room for two people with Medicare and one employer-coverage block. */
export const MEDICARE_LINES = 2
export const EMPLOYER_COVERAGE_LINES = 1

/**
 * Step 8 Q3 / 3a / 3b have a "Your spouse" column. The wizard hides its spouse questions whenever the
 * Person 2 step is hidden, but the column is about a SPOUSE, so it is also left blank unless Person 1 is
 * legally married (`householdHasSpouse`). A single applicant never gets a Yes or a No for a spouse.
 */
const registry: DerivedRegistry = {}

for (const key of ["permanentDisability", "disabilityBlocksAdls", "willContactPcmAgency"] as const) {
  registry[`pca.spouse.${key}`] = (reader, answers, on) =>
    householdHasSpouse(reader, answers, on)
      ? reader.get({ kind: "answer", stepId: "pca", path: `pca.byPerson.1.${key}` })
      : undefined
}

export const HEALTH_DERIVED: DerivedRegistry = registry
