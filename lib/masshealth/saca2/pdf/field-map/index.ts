/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FieldEntry } from "../types"
import { ASSETS_ENTRIES } from "./assets"
import { ATTACHMENTS_ENTRIES } from "./attachments"
import { INTAKE_ENTRIES } from "./intake"
import { PERSON_TABLE, expandPersonTable } from "./person-table"
import { PERSON1_A_ENTRIES } from "./person1-a"
import { STEP_10_ENTRIES } from "./step-10"
import { SUPP_A_ENTRIES } from "./supp-a"
import { SUPP_BCD_COPY_ENTRIES, SUPP_BCD_ENTRIES } from "./supp-bcd"
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
  ...SUPP_BCD_ENTRIES,
  ...ATTACHMENTS_ENTRIES,
]

/**
 * What the fill uses: FIELD_MAP plus the entries of the page copies made at fill time (Supplement B pages 2-3,
 * Supplement C's second person, Supplement D jobs 2-4). The coverage ratchet and the inventory describe the template
 * only, so FIELD_MAP stays the template map; copy fields are `<template field>__copy<n>`.
 */
export const FILL_MAP: FieldEntry[] = [...FIELD_MAP, ...SUPP_BCD_COPY_ENTRIES]
