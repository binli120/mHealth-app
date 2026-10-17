/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FieldEntry } from "../types"
import { INTAKE_ENTRIES } from "./intake"
import { PERSON_TABLE, expandPersonTable } from "./person-table"
import { PERSON1_A_ENTRIES } from "./person1-a"

/**
 * The complete SACA-2 field map. Each region of the form contributes entries from its own module;
 * they are concatenated here. Person 1 and Person 2 questions come from the shared PERSON_TABLE.
 */
export const FIELD_MAP: FieldEntry[] = [...INTAKE_ENTRIES, ...PERSON1_A_ENTRIES, ...expandPersonTable(PERSON_TABLE)]
