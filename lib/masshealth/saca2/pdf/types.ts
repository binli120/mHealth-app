/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2StepId } from "../schema"

/** How a source value becomes text (or a checkbox state) on the form. */
export type Encoder =
  | "text"
  | "date"
  | "money"
  | "phone"
  | "number"
  | "upper"
  /** Nine single-character digit boxes; the form's dash separators are static and not listed. */
  | { kind: "ssn" }
  /** Zero-padded digits of a fixed width; one character per field when several fields are given. */
  | { kind: "digits"; width: number }
  /** "yes" / "no" answers onto the two on-states of ONE checkbox group. */
  | { kind: "yesNo"; yes: string; no: string }
  /** Enum value -> on-state of ONE checkbox group. Values without an entry are left unchecked. */
  | { kind: "pick"; states: Record<string, string> }
  /** Single /On checkbox: true -> checked. */
  | { kind: "check" }

export type Source =
  /**
   * `path` is the question path as the step content writes it (relative to the step scope).
   * For person steps, `person` selects the block (0 = Person 1, 1 = Person 2) and defaults to
   * the step's own person; `stepId: "person1"` with `person: 1` therefore reads Person 2.
   */
  | { kind: "answer"; stepId: Saca2StepId; path: string; person?: 0 | 1 }
  /** `index`-th row of the repeater at `path`, field `key`. */
  | { kind: "row"; stepId: Saca2StepId; path: string; index: number; key: string; person?: 0 | 1 }
  /** Computed by pdf-fill from a registered function (e.g. Person 1 full name for headers). */
  | { kind: "derived"; id: string }

export interface FieldEntry {
  /**
   * One or more AcroForm field names written from the same value. A value is repeated into each
   * name (e.g. a header repeated on several pages); `ssn` takes exactly nine digit boxes in order
   * and `digits` with several fields takes `width` of them, one character each.
   */
  fields: string[]
  source: Source
  encode: Encoder
}

/** A value ready to be written: text for text fields, `{ state }` for checkbox groups. */
export type FillValue = string | { state: string | null }

export interface FillItem {
  field: string
  value: FillValue
}
