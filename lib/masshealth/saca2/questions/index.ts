/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2StepId } from "../schema"
import type { Saca2Answers } from "../types"
import { ASSETS_STEP_CONTENT } from "./assets"
import { PERSON_STEP_CONTENT } from "./person"
import {
  AIAN_STEP_CONTENT,
  INTAKE_STEP_CONTENT,
  PREVIOUS_BILLS_STEP_CONTENT,
  SIGNATURE_STEP_CONTENT,
} from "./root-steps"
import type { Saca2StepContent } from "./types"
import { validateQuestions } from "./validate"

const CONTENT: Partial<Record<Saca2StepId, Saca2StepContent>> = {
  intake: INTAKE_STEP_CONTENT,
  person1: PERSON_STEP_CONTENT,
  person2: PERSON_STEP_CONTENT,
  aian: AIAN_STEP_CONTENT,
  previousBills: PREVIOUS_BILLS_STEP_CONTENT,
  assets: ASSETS_STEP_CONTENT,
  signature: SIGNATURE_STEP_CONTENT,
}

export const IMPLEMENTED_STEP_IDS: ReadonlySet<Saca2StepId> = new Set(Object.keys(CONTENT) as Saca2StepId[])

export const STEP_TITLES: Record<Saca2StepId, string> = {
  intake: "Programs",
  person1: "Person 1 information",
  person2: "Person 2 information",
  aian: "American Indian or Alaska Native members",
  previousBills: "Previous medical bills",
  assets: "Assets",
  healthInsurance: "Health insurance",
  hra: "Health reimbursement arrangements",
  pca: "Personal-care attendant services",
  additionalCoverage: "Additional coverage for married persons under 65",
  signature: "Who will sign",
  suppA: "Supplement A: Long-term care",
  suppB: "Supplement B: American Indian or Alaska Native",
  suppC: "Supplement C: Personal-care attendant",
  suppD: "Supplement D: Health coverage from jobs",
  ard: "Authorized Representative Designation",
  irs4506: "IRS Form 4506",
}

export function getStepContent(stepId: Saca2StepId): Saca2StepContent | null {
  return CONTENT[stepId] ?? null
}

export function getStepPersonIndex(stepId: Saca2StepId): number {
  return stepId === "person2" ? 1 : 0
}

/** Validate one step; keys are absolute answer paths, `{}` means the step can advance. */
export function validateStep(stepId: Saca2StepId, answers: Saca2Answers, on: Date): Record<string, string> {
  const content = getStepContent(stepId)
  if (!content) return {}
  const personIndex = getStepPersonIndex(stepId)
  const ctx = { answers, personIndex, on }
  const errors: Record<string, string> = {}
  for (const section of content.sections) {
    validateQuestions(section.questions, ctx, content.scope, personIndex, undefined, errors)
  }
  return { ...errors, ...(content.validateStep?.(answers, personIndex) ?? {}) }
}
