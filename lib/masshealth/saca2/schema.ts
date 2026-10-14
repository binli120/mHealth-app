/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export type Saca2StepId =
  | "intake"
  | "person1"
  | "person2"
  | "aian"
  | "previousBills"
  | "assets"
  | "healthInsurance"
  | "hra"
  | "pca"
  | "additionalCoverage"
  | "signature"
  | "suppA"
  | "suppB"
  | "suppC"
  | "suppD"
  | "ard"
  | "irs4506"

export interface Saca2StepDef {
  id: Saca2StepId
  kind: "step" | "supplement" | "attachment"
  /** The form's own "STEP n" number; null for the intake block, supplements, and attachments. */
  formStep: number | null
  /** Inclusive form-page range in the SACA-2_2026-08 PDF (form pages, not PDF indices). */
  formPages: readonly [number, number]
  titleKey: string
}

/** Steps in form order. Question-level schema is added in the wizard plan. */
export const SACA2_STEPS: readonly Saca2StepDef[] = [
  { id: "intake", kind: "step", formStep: null, formPages: [1, 1], titleKey: "saca2.step.intake" },
  { id: "person1", kind: "step", formStep: 1, formPages: [1, 6], titleKey: "saca2.step.person1" },
  { id: "person2", kind: "step", formStep: 2, formPages: [7, 11], titleKey: "saca2.step.person2" },
  { id: "aian", kind: "step", formStep: 3, formPages: [12, 12], titleKey: "saca2.step.aian" },
  { id: "previousBills", kind: "step", formStep: 4, formPages: [12, 12], titleKey: "saca2.step.previousBills" },
  { id: "assets", kind: "step", formStep: 5, formPages: [12, 15], titleKey: "saca2.step.assets" },
  { id: "healthInsurance", kind: "step", formStep: 6, formPages: [16, 16], titleKey: "saca2.step.healthInsurance" },
  { id: "hra", kind: "step", formStep: 7, formPages: [17, 17], titleKey: "saca2.step.hra" },
  { id: "pca", kind: "step", formStep: 8, formPages: [17, 18], titleKey: "saca2.step.pca" },
  { id: "additionalCoverage", kind: "step", formStep: 9, formPages: [18, 18], titleKey: "saca2.step.additionalCoverage" },
  { id: "signature", kind: "step", formStep: 10, formPages: [18, 24], titleKey: "saca2.step.signature" },
  { id: "suppA", kind: "supplement", formStep: null, formPages: [25, 28], titleKey: "saca2.step.suppA" },
  { id: "suppB", kind: "supplement", formStep: null, formPages: [29, 29], titleKey: "saca2.step.suppB" },
  { id: "suppC", kind: "supplement", formStep: null, formPages: [30, 30], titleKey: "saca2.step.suppC" },
  { id: "suppD", kind: "supplement", formStep: null, formPages: [31, 31], titleKey: "saca2.step.suppD" },
  { id: "ard", kind: "attachment", formStep: null, formPages: [33, 36], titleKey: "saca2.step.ard" },
  { id: "irs4506", kind: "attachment", formStep: null, formPages: [37, 38], titleKey: "saca2.step.irs4506" },
]

export function getStepDef(id: Saca2StepId): Saca2StepDef {
  const def = SACA2_STEPS.find((s) => s.id === id)
  if (!def) throw new Error(`Unknown step: ${String(id)}`)
  return def
}
