/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { splitWizardState } from "@/lib/phi-token/token"
import { setAtPath } from "./answer-paths"
import { IMPLEMENTED_STEP_IDS } from "./questions"
import { SACA2_STEPS, type Saca2StepId } from "./schema"
import {
  SACA2_SCHEMA_VERSION,
  emptySaca2Answers,
  emptySaca2Person,
  type Saca2Answers,
  type Saca2Person,
} from "./types"
import { getVisibleSteps } from "./visibility"

/** Mirrors MAX_APPLICATION_DRAFT_STEP in lib/db/application-drafts.ts (a test keeps them equal). */
export const SERVER_DRAFT_MAX_STEP = 9

export interface Saca2WizardState {
  schemaVersion: typeof SACA2_SCHEMA_VERSION
  data: Saca2Answers
  currentStepId: Saca2StepId
  /** 1-based position (in SACA2_STEPS order) of the furthest step ever reached. */
  furthestStepNumber: number
  completedSteps: Saca2StepId[]
  errors: Record<string, string>
  /** Changes not yet autosaved to the server (PHI-free snapshot). */
  dirty: boolean
  /** Changes not yet secured by Save & Exit (encrypted PHI blob). */
  phiDirty: boolean
}

export type Saca2WizardAction =
  | { type: "hydrate"; payload: Saca2WizardState }
  | { type: "set_answer"; path: string; value: unknown }
  | { type: "set_step"; stepId: Saca2StepId }
  | { type: "mark_complete"; stepId: Saca2StepId }
  | { type: "set_errors"; errors: Record<string, string> }
  | { type: "mark_saved" }
  | { type: "mark_phi_secured" }

const STEP_ID_SET: ReadonlySet<string> = new Set(SACA2_STEPS.map((step) => step.id))

function stepNumber(stepId: Saca2StepId): number {
  return SACA2_STEPS.findIndex((step) => step.id === stepId) + 1
}

export function createInitialWizardState(): Saca2WizardState {
  return {
    schemaVersion: SACA2_SCHEMA_VERSION,
    data: emptySaca2Answers(),
    currentStepId: "intake",
    furthestStepNumber: 1,
    completedSteps: [],
    errors: {},
    dirty: false,
    phiDirty: false,
  }
}

export function saca2WizardReducer(state: Saca2WizardState, action: Saca2WizardAction): Saca2WizardState {
  switch (action.type) {
    case "hydrate":
      return action.payload
    case "set_answer": {
      const errors = { ...state.errors }
      delete errors[action.path]
      return {
        ...state,
        data: setAtPath(state.data, action.path, action.value),
        errors,
        dirty: true,
        phiDirty: true,
      }
    }
    case "set_step": {
      const addPerson = action.stepId === "person2" && state.data.persons.length < 2
      return {
        ...state,
        data: addPerson ? { ...state.data, persons: [...state.data.persons, emptySaca2Person()] } : state.data,
        currentStepId: action.stepId,
        furthestStepNumber: Math.max(state.furthestStepNumber, stepNumber(action.stepId)),
        errors: {},
        dirty: true,
        phiDirty: state.phiDirty || addPerson,
      }
    }
    case "mark_complete":
      return state.completedSteps.includes(action.stepId)
        ? state
        : { ...state, completedSteps: [...state.completedSteps, action.stepId], dirty: true }
    case "set_errors":
      return { ...state, errors: action.errors }
    case "mark_saved":
      return { ...state, dirty: false }
    case "mark_phi_secured":
      return { ...state, phiDirty: false }
  }
}

/** Visible steps that have question content (steps without content are added in later plans). */
export function getWizardSteps(answers: Saca2Answers, on: Date): Saca2StepId[] {
  return getVisibleSteps(answers, on).filter((id) => IMPLEMENTED_STEP_IDS.has(id))
}

/**
 * Snapshot written to the server (after the PHI split) and to the encrypted blob.
 * `currentStep` is the furthest step reached, capped for the draft route, so a save
 * after stepping back never looks like a regression to the server's progress guard.
 */
export function buildSaca2Snapshot(state: Saca2WizardState): Record<string, unknown> {
  return {
    schemaVersion: SACA2_SCHEMA_VERSION,
    currentStepId: state.currentStepId,
    currentStep: Math.min(SERVER_DRAFT_MAX_STEP, Math.max(1, state.furthestStepNumber)),
    furthestStepNumber: state.furthestStepNumber,
    completedSteps: state.completedSteps,
    data: state.data,
    persistedAt: new Date().toISOString(),
  }
}

/** Stable key of the PHI-free snapshot that autosave would send (excludes `persistedAt`). */
export function buildSaca2SaveKey(state: Saca2WizardState): string {
  const { safeState } = splitWizardState(buildSaca2Snapshot(state))
  const comparable = { ...safeState } as Record<string, unknown>
  delete comparable.persistedAt
  return JSON.stringify(comparable)
}

/** The last visible step at or before `current` in SACA2_STEPS order, else the first visible step. */
export function nearestVisibleStep(stepIds: Saca2StepId[], current: Saca2StepId): Saca2StepId {
  const order = (id: Saca2StepId) => SACA2_STEPS.findIndex((step) => step.id === id)
  const currentOrder = order(current)
  let result = stepIds[0]
  for (const id of stepIds) {
    if (order(id) <= currentOrder) result = id
  }
  return result
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function safeEntries(value: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(value).filter(([key]) => !FORBIDDEN_KEYS.has(key))
}

/** Deep copy of a plain object with forbidden keys dropped; non-plain values are kept as-is. */
function sanitizeDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDeep)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(safeEntries(value).map(([key, v]) => [key, sanitizeDeep(v)]))
}

/**
 * Overlay `raw` onto `base`, keeping base's shape and value types. Anything of the wrong
 * type is ignored (base kept), so a corrupt draft can never produce state that crashes render.
 * Arrays are replaced wholesale but only keep strings and plain objects.
 */
function overlay<T>(base: T, raw: unknown): T {
  if (Array.isArray(base)) {
    if (!Array.isArray(raw)) return base
    const kept = raw.filter((item) => typeof item === "string" || isPlainObject(item)).map(sanitizeDeep)
    return kept as unknown as T
  }
  if (isPlainObject(base)) {
    if (!isPlainObject(raw)) return base
    // An empty base object is a free-form map (e.g. assets.gates, supplements.c[].activities).
    if (Object.keys(base).length === 0) return sanitizeDeep(raw) as T
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of safeEntries(raw)) {
      if (!Object.hasOwn(base, key)) continue
      out[key] = overlay((base as Record<string, unknown>)[key], value)
    }
    return out as T
  }
  if (base === null) {
    return typeof raw === "string" || typeof raw === "boolean" || raw === null || (typeof raw === "number" && Number.isFinite(raw))
      ? (raw as T)
      : base
  }
  if (typeof base === "number") return typeof raw === "number" && Number.isFinite(raw) ? (raw as T) : base
  return typeof raw === typeof base ? (raw as T) : base
}

/** Merge each entry of a fixed-length list over its default so a short or older array still has every field. */
function padFixedList<T>(items: T[], defaults: T[]): T[] {
  return defaults.map((fallback, index) => overlay(fallback, items[index]))
}

/** Supplement C always has exactly three health-problem slots so `healthProblems.1/.2` paths resolve. */
function padHealthProblems(items: unknown): string[] {
  const list = Array.isArray(items) ? items : []
  return [0, 1, 2].map((i) => (typeof list[i] === "string" ? (list[i] as string) : ""))
}

/** Deduction amounts default to null, so the generic overlay cannot tell they must be numbers. */
function normalizePerson(person: Saca2Person): Saca2Person {
  const amounts = Object.fromEntries(
    Object.entries(person.deductions.amounts).map(([key, value]) => [key, typeof value === "number" && Number.isFinite(value) ? value : null]),
  ) as Saca2Person["deductions"]["amounts"]
  return { ...person, deductions: { ...person.deductions, amounts } }
}

function normalizeAnswers(raw: unknown): Saca2Answers {
  const base = emptySaca2Answers()
  if (!isPlainObject(raw)) return base
  const merged = overlay(base, { ...raw, persons: undefined }) as Saca2Answers

  const rawPersons = Array.isArray(raw.persons) ? raw.persons : []
  const persons = rawPersons
    .filter(isPlainObject)
    .slice(0, 2)
    .map((rawPerson) => normalizePerson(overlay(emptySaca2Person(), rawPerson)))
  return {
    ...merged,
    persons: persons.length > 0 ? persons : base.persons,
    pca: { ...merged.pca, byPerson: padFixedList(merged.pca.byPerson, base.pca.byPerson) },
    supplements: {
      ...merged.supplements,
      c: padFixedList(merged.supplements.c, base.supplements.c).map((entry) => ({
        ...entry,
        healthProblems: padHealthProblems(entry.healthProblems),
      })),
    },
  }
}

export function normalizeSaca2State(raw: unknown): Saca2WizardState | null {
  if (!isPlainObject(raw) || raw.schemaVersion !== SACA2_SCHEMA_VERSION || !isPlainObject(raw.data)) {
    return null
  }

  const currentStepId =
    typeof raw.currentStepId === "string" && STEP_ID_SET.has(raw.currentStepId)
      ? (raw.currentStepId as Saca2StepId)
      : "intake"
  const completedSteps = Array.isArray(raw.completedSteps)
    ? raw.completedSteps.filter((id): id is Saca2StepId => typeof id === "string" && STEP_ID_SET.has(id))
    : []
  const furthest =
    typeof raw.furthestStepNumber === "number" && Number.isInteger(raw.furthestStepNumber) && raw.furthestStepNumber >= 1
      ? Math.min(raw.furthestStepNumber, SACA2_STEPS.length)
      : stepNumber(currentStepId)

  return {
    schemaVersion: SACA2_SCHEMA_VERSION,
    data: normalizeAnswers(raw.data),
    currentStepId,
    furthestStepNumber: Math.max(furthest, stepNumber(currentStepId)),
    completedSteps,
    errors: {},
    dirty: false,
    phiDirty: false,
  }
}

/** Normalize a restored PHI blob / merged state; the blob only exists for the current schema. */
export function normalizeRestoredSaca2State(merged: unknown): Saca2WizardState | null {
  if (!isPlainObject(merged)) return null
  return normalizeSaca2State({ ...merged, schemaVersion: SACA2_SCHEMA_VERSION })
}
