/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FieldEntry } from "../types"
import { ASSETS_ENTRIES } from "./assets"
import { INTAKE_ENTRIES } from "./intake"
import { PERSON_TABLE, expandPersonTable } from "./person-table"
import { PERSON1_A_ENTRIES } from "./person1-a"
import { STEP_10_ENTRIES } from "./step-10"
import { SUPP_A_ENTRIES } from "./supp-a"
import { STEPS_3_4_ENTRIES } from "./steps-3-5"
import { STEPS_6_9_ENTRIES } from "./steps-6-9"

/**
 * The complete SACA-2 field map. Each region of the form contributes entries from its own module;
 * they are concatenated here. Person 1 and Person 2 questions come from the shared PERSON_TABLE.
 */
export const FIELD_MAP: FieldEntry[] = [
  ...INTAKE_ENTRIES,
  ...PERSON1_A_ENTRIES,
  ...expandPersonTable(PERSON_TABLE),
  ...STEPS_3_4_ENTRIES,
  ...ASSETS_ENTRIES,
  ...STEPS_6_9_ENTRIES,
  ...STEP_10_ENTRIES,
  ...SUPP_A_ENTRIES,
]
