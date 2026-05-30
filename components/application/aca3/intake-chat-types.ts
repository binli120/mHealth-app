/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Shared type definitions for the intake-chat sub-modules and tests.
 */

import type { SchemaField, PersonSectionKey } from "./types"

// Re-export canonical wizard types so test files can import WizardData from here
export type {
  WizardData,
  WizardState,
  PersonState,
  PersonSectionKey,
  FormRecord,
  FieldValue,
  SchemaField,
} from "./types"

// ── IntakeQuestion types ───────────────────────────────────────────────────────

export interface RepeatableCountQuestion {
  kind: "repeatable_count"
  parentField: SchemaField
}

export interface RepeatableFieldQuestion {
  kind: "repeatable_field"
  parentField: SchemaField
  rowIndex: number
}

export interface ChecklistSelectionQuestion {
  kind: "checklist_selection"
  parentField: SchemaField
}

export interface ChecklistItemFieldQuestion {
  kind: "checklist_item_field"
  parentField: SchemaField
  itemId: string
  valueKey: string
}

export type IntakeQuestionComplex =
  | RepeatableCountQuestion
  | RepeatableFieldQuestion
  | ChecklistSelectionQuestion
  | ChecklistItemFieldQuestion

export interface IntakeQuestion {
  id: string
  field: SchemaField
  scope: "preApp" | "contact" | "assister" | "person"
  sectionKey?: PersonSectionKey
  personIndex?: number
  complex?: IntakeQuestionComplex
}
