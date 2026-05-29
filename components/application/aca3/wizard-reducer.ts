/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Pure (no JSX, no hooks) state logic for the ACA-3 form wizard.
 * Extracted from form-wizard.tsx so these functions can be unit-tested
 * in isolation without mounting the full component tree.
 *
 * Exports:
 *   normalizeScalarFieldValue — field default resolver
 *   seedFieldDefaults         — in-place initialiser for a FormRecord
 *   makeDefaultPersonState    — build a blank PersonState for a given index
 *   clampPersonCount          — bounds-check a person count input
 *   createInitialData         — zero-filled WizardData
 *   createInitialState        — initial WizardState (step 1, no data)
 *   formReducer               — pure reducer for all wizard state transitions
 */

import {
  ACA3_SCHEMA,
  FORM_CACHE_KEY_PREFIX,
  MAX_PERSON_COUNT,
  PERSON_SECTION_MAP,
} from "@/lib/constant"
import type {
  FieldValue,
  FormRecord,
  PersonState,
  SchemaField,
  WizardAction,
  WizardData,
  WizardState,
} from "./types"

// ── Field-default helpers ─────────────────────────────────────────────────────

export function normalizeScalarFieldValue(field: SchemaField): FieldValue {
  if (field.value !== null && field.value !== undefined) {
    return field.value as FieldValue
  }

  switch (field.type) {
    case "checkbox":
      return false
    case "checkbox_group":
      return []
    case "repeatable_group":
      return []
    case "income_checklist":
    case "deduction_checklist": {
      const result: Record<string, unknown> = {}
      for (const item of field.items ?? []) {
        result[item.id] = { selected: false }
      }
      return result
    }
    case "number":
    case "currency":
    case "text":
    case "textarea":
    case "date":
    case "email":
    case "phone":
    case "zip":
    case "ssn":
    case "radio":
    case "select":
      return ""
    default:
      return ""
  }
}

export function seedFieldDefaults(fields: SchemaField[], target: FormRecord): void {
  for (const field of fields) {
    if (target[field.id] === undefined) {
      target[field.id] = normalizeScalarFieldValue(field)
    }

    if (field.type === "address_group" && field.fields) {
      seedFieldDefaults(Object.values(field.fields), target)
    }

    if (field.type === "repeatable_group" && Array.isArray(target[field.id])) {
      target[field.id] = []
    }

    if (field.sub_fields) {
      for (const subGroup of Object.values(field.sub_fields)) {
        seedFieldDefaults(subGroup, target)
      }
    }
  }
}

// ── Person state ──────────────────────────────────────────────────────────────

export function makeDefaultPersonState(index: number): PersonState {
  const state: PersonState = {
    identity: {},
    demographics: {},
    ssn: {},
    tax: {},
    coverage: {},
    income: {},
    skippedOptional: {},
  }

  for (const section of ACA3_SCHEMA.person_schema.sub_sections) {
    const sectionId = section.sub_section_id
    if (!sectionId) continue

    const key = PERSON_SECTION_MAP[sectionId]
    if (!key) continue

    seedFieldDefaults(section.fields, state[key])

    if (index === 0 && sectionId === "ss_identity") {
      state.identity.relationship_to_p1 = "SELF"
    }
  }

  return state
}

// ── Person-count bounds ───────────────────────────────────────────────────────

export function clampPersonCount(value: unknown): number {
  const parsed = Number.parseInt(String(value || "1"), 10)
  if (!Number.isFinite(parsed)) return 1
  return Math.min(MAX_PERSON_COUNT, Math.max(1, parsed))
}

// ── Initial state factories ───────────────────────────────────────────────────

export function getFormCacheKey(applicationId: string): string {
  return `${FORM_CACHE_KEY_PREFIX}:${applicationId}`
}

export function createInitialData(): WizardData {
  const preApp: FormRecord = {}
  const contact: FormRecord = {}
  const assister: FormRecord = {}

  seedFieldDefaults(ACA3_SCHEMA.pre_application.fields, preApp)
  seedFieldDefaults(ACA3_SCHEMA.step1_contact.fields, contact)
  seedFieldDefaults(ACA3_SCHEMA.enrollment_assister.fields, assister)

  const personCount = clampPersonCount(contact.p1_num_people || 1)
  const persons = Array.from({ length: personCount }, (_, index) => makeDefaultPersonState(index))

  contact.p1_num_people = String(personCount)

  return {
    preApp,
    contact,
    assister,
    assisterEnabled: false,
    persons,
    attestation: false,
  }
}

export function ensurePersonCount(data: WizardData, count: number): WizardData {
  const nextCount = clampPersonCount(count)
  const nextPeople = [...data.persons]

  if (nextPeople.length > nextCount) {
    nextPeople.length = nextCount
  }

  if (nextPeople.length < nextCount) {
    for (let index = nextPeople.length; index < nextCount; index += 1) {
      nextPeople.push(makeDefaultPersonState(index))
    }
  }

  return {
    ...data,
    contact: {
      ...data.contact,
      p1_num_people: String(nextCount),
    },
    persons: nextPeople,
  }
}

export function createDraftWizardState(data: WizardData, currentStep = 1): WizardState {
  return {
    data,
    currentStep,
    completedSteps: Array.from({ length: Math.max(0, currentStep - 1) }, (_, i) => i + 1),
    tabByStep: { 4: 0, 5: 0, 6: 0, 7: 0 },
    errors: {},
    dirty: true,
    submitted: false,
  }
}

export function createInitialState(): WizardState {
  return {
    data: createInitialData(),
    currentStep: 1,
    completedSteps: [],
    tabByStep: { 4: 0, 5: 0, 6: 0, 7: 0 },
    errors: {},
    dirty: false,
    submitted: false,
  }
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function formReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "hydrate":
      return action.payload

    case "set_step":
      return { ...state, currentStep: action.payload, errors: {} }

    case "mark_step_complete":
      return {
        ...state,
        completedSteps: state.completedSteps.includes(action.payload)
          ? state.completedSteps
          : [...state.completedSteps, action.payload],
      }

    case "set_root_field": {
      const { scope, fieldId, value } = action.payload
      return {
        ...state,
        data: {
          ...state.data,
          [scope]: { ...state.data[scope], [fieldId]: value },
        },
        dirty: true,
      }
    }

    case "set_assister_enabled":
      return {
        ...state,
        data: { ...state.data, assisterEnabled: action.payload },
        dirty: true,
      }

    case "set_person_count": {
      const count = clampPersonCount(action.payload)
      const current = state.data.persons
      let nextPeople: PersonState[] = current

      if (current.length > count) {
        nextPeople = current.slice(0, count)
      } else if (current.length < count) {
        nextPeople = [...current]
        for (let index = current.length; index < count; index += 1) {
          nextPeople.push(makeDefaultPersonState(index))
        }
      }

      const currentTabs = { ...state.tabByStep }
      for (const step of [4, 5, 6, 7]) {
        if ((currentTabs[step] ?? 0) > count - 1) currentTabs[step] = 0
      }

      return {
        ...state,
        tabByStep: currentTabs,
        data: {
          ...state.data,
          contact: { ...state.data.contact, p1_num_people: String(count) },
          persons: nextPeople,
        },
        dirty: true,
      }
    }

    case "set_person_field": {
      const { personIndex, section, fieldId, value } = action.payload
      const nextPeople = [...state.data.persons]
      const person = nextPeople[personIndex]
      if (!person) return state

      nextPeople[personIndex] = {
        ...person,
        [section]: { ...person[section], [fieldId]: value },
      }
      return { ...state, data: { ...state.data, persons: nextPeople }, dirty: true }
    }

    case "set_person_optional_skip": {
      const { personIndex, sectionId, value } = action.payload
      const nextPeople = [...state.data.persons]
      const person = nextPeople[personIndex]
      if (!person) return state

      nextPeople[personIndex] = {
        ...person,
        skippedOptional: { ...person.skippedOptional, [sectionId]: value },
      }
      return { ...state, data: { ...state.data, persons: nextPeople }, dirty: true }
    }

    case "set_tab":
      return {
        ...state,
        tabByStep: { ...state.tabByStep, [action.payload.step]: action.payload.tab },
      }

    case "set_errors":
      return { ...state, errors: action.payload }

    case "clear_errors":
      return { ...state, errors: {} }

    case "set_attestation":
      return {
        ...state,
        data: { ...state.data, attestation: action.payload },
        dirty: true,
      }

    case "set_submitted":
      return { ...state, submitted: action.payload, dirty: false }

    case "set_dirty":
      return { ...state, dirty: action.payload }

    default:
      return state
  }
}
