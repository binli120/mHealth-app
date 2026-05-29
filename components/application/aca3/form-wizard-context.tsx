/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */
// createContext / useContext are client-only in Next.js App Router
"use client"

import { createContext, useContext } from "react"
import { splitWizardState } from "@/lib/phi-token/token"
import { PHI_DATA_KEYS } from "@/lib/phi-token/phi-fields"
import type { FieldValue, FormContextValue, PersonState, SchemaField, WizardData, WizardState } from "./types"
import {
  clampPersonCount,
  createInitialData,
  createInitialState,
  makeDefaultPersonState,
  normalizeScalarFieldValue,
} from "./wizard-reducer"

export function getIncomeChecklistMemberId(applicationId: string, personIndex: number): string {
  const normalizedApplicationId = applicationId.replace(/-/g, "").toLowerCase()

  if (!/^[0-9a-f]{32}$/.test(normalizedApplicationId)) {
    return `00000000-0000-4000-8000-${String(personIndex + 1).padStart(12, "0")}`
  }

  const suffix = (personIndex + 1).toString(16).padStart(2, "0")
  const memberHex = `${normalizedApplicationId.slice(0, 30)}${suffix}`
  return `${memberHex.slice(0, 8)}-${memberHex.slice(8, 12)}-${memberHex.slice(12, 16)}-${memberHex.slice(16, 20)}-${memberHex.slice(20)}`
}

export function getRepeatableRowDefault(groupSchema: SchemaField[]): Record<string, unknown> {
  const row: Record<string, unknown> = {}

  for (const field of groupSchema) {
    row[field.id] = normalizeScalarFieldValue(field)

    if (field.sub_fields) {
      for (const subFields of Object.values(field.sub_fields)) {
        for (const subField of subFields) {
          row[subField.id] = normalizeScalarFieldValue(subField)
        }
      }
    }
  }

  return row
}

export function getActiveSubFields(field: SchemaField, value: unknown): SchemaField[] {
  if (!field.sub_fields) {
    return []
  }

  const active: SchemaField[] = []
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : value

  for (const [key, subFields] of Object.entries(field.sub_fields)) {
    if (key === "if_yes" && normalizedValue === "yes") {
      active.push(...subFields)
    }

    if (key === "if_no" && normalizedValue === "no") {
      active.push(...subFields)
    }

    if (key.startsWith("if_includes_")) {
      const option = key.replace("if_includes_", "")
      if (Array.isArray(value) && value.includes(option)) {
        active.push(...subFields)
      }
    }
  }

  return active
}

export const FormContext = createContext<FormContextValue | null>(null)

export function useFormContext(): FormContextValue {
  const context = useContext(FormContext)

  if (!context) {
    throw new Error("useFormContext must be used inside FormProvider")
  }

  return context
}

export function normalizeHydratedState(raw: unknown): WizardState | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const fallback = createInitialState()
  const value = raw as Partial<WizardState>
  const data = value.data

  if (!data || typeof data !== "object") {
    return null
  }

  const initialData = createInitialData()
  const hydratedData: WizardData = {
    ...initialData,
    ...data,
    preApp: {
      ...initialData.preApp,
      ...((data as Partial<WizardData>).preApp ?? {}),
    },
    contact: {
      ...initialData.contact,
      ...((data as Partial<WizardData>).contact ?? {}),
    },
    assister: {
      ...initialData.assister,
      ...((data as Partial<WizardData>).assister ?? {}),
    },
    persons: Array.isArray((data as Partial<WizardData>).persons)
      ? (data as Partial<WizardData>).persons!.map((person, index) => {
          const base = makeDefaultPersonState(index)
          const safePerson = person as Partial<PersonState>

          return {
            ...base,
            ...safePerson,
            identity: {
              ...base.identity,
              ...(safePerson.identity ?? {}),
            },
            demographics: {
              ...base.demographics,
              ...(safePerson.demographics ?? {}),
            },
            ssn: {
              ...base.ssn,
              ...(safePerson.ssn ?? {}),
            },
            tax: {
              ...base.tax,
              ...(safePerson.tax ?? {}),
            },
            coverage: {
              ...base.coverage,
              ...(safePerson.coverage ?? {}),
            },
            income: {
              ...base.income,
              ...(safePerson.income ?? {}),
            },
            skippedOptional: {
              ...base.skippedOptional,
              ...(safePerson.skippedOptional ?? {}),
            },
          }
        })
      : initialData.persons,
  }

  const personCount = clampPersonCount(hydratedData.contact.p1_num_people || 1)
  hydratedData.contact.p1_num_people = String(personCount)

  if (hydratedData.persons.length > personCount) {
    hydratedData.persons = hydratedData.persons.slice(0, personCount)
  }

  if (hydratedData.persons.length < personCount) {
    for (let index = hydratedData.persons.length; index < personCount; index += 1) {
      hydratedData.persons.push(makeDefaultPersonState(index))
    }
  }

  return {
    ...fallback,
    ...value,
    data: hydratedData,
    completedSteps: Array.isArray(value.completedSteps)
      ? value.completedSteps.filter((step): step is number => Number.isInteger(step))
      : [],
    currentStep:
      typeof value.currentStep === "number" && value.currentStep >= 1 && value.currentStep <= 9
        ? value.currentStep
        : 1,
    tabByStep: {
      ...fallback.tabByStep,
      ...(value.tabByStep ?? {}),
    },
    errors: {},
    dirty: false,
    submitted: Boolean(value.submitted),
  }
}

export function buildPersistedStateSnapshot(sourceState: WizardState): Record<string, unknown> {
  return {
    ...sourceState,
    errors: {},
    persistedAt: new Date().toISOString(),
  }
}

/** PHI-free snapshot sent to the server. PHI stays in the client-side token. */
export function buildSafeServerSnapshot(sourceState: WizardState): Record<string, unknown> {
  const full = buildPersistedStateSnapshot(sourceState)
  const { safeState } = splitWizardState(full)
  return safeState
}

export function getPersistedAt(raw: unknown): number {
  if (!raw || typeof raw !== "object" || !("persistedAt" in raw)) {
    return 0
  }

  const value = (raw as { persistedAt?: unknown }).persistedAt
  if (typeof value === "string" || typeof value === "number") {
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  return 0
}

export function choosePreferredHydratedRaw(
  candidates: Array<{ source: "local" | "server" | "redux"; raw: unknown }>,
): unknown | null {
  const priority: Record<"local" | "server" | "redux", number> = {
    local: 3,
    server: 2,
    redux: 1,
  }

  const valid = candidates.filter((candidate) => normalizeHydratedState(candidate.raw))
  if (valid.length === 0) {
    return null
  }

  valid.sort((left, right) => {
    const timestampDiff = getPersistedAt(right.raw) - getPersistedAt(left.raw)
    if (timestampDiff !== 0) {
      return timestampDiff
    }
    return priority[right.source] - priority[left.source]
  })

  return valid[0]?.raw ?? null
}

export function hasMeaningfulPhiValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
  }

  if (value === true) {
    return true
  }

  if (Array.isArray(value)) {
    return value.some(hasMeaningfulPhiValue)
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasMeaningfulPhiValue)
  }

  return false
}

export function hasMeaningfulPhiData(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") {
    return false
  }

  const data = (raw as { data?: unknown }).data
  if (!data || typeof data !== "object") {
    return false
  }

  const record = data as Record<string, unknown>
  return PHI_DATA_KEYS.some((key) => hasMeaningfulPhiValue(record[key]))
}

export function toHydrationRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
}

export function mergePhiDataFromRaw(baseRaw: unknown, phiRaw: unknown): Record<string, unknown> {
  const base = toHydrationRecord(baseRaw)
  const baseData = base.data && typeof base.data === "object"
    ? base.data as Record<string, unknown>
    : {}
  const phiDataSource = toHydrationRecord(phiRaw).data
  const phiData = phiDataSource && typeof phiDataSource === "object"
    ? phiDataSource as Record<string, unknown>
    : {}
  const nextPhiData: Record<string, unknown> = {}

  for (const key of PHI_DATA_KEYS) {
    if (key in phiData) {
      nextPhiData[key] = phiData[key]
    }
  }

  return {
    ...base,
    data: {
      ...baseData,
      ...nextPhiData,
    },
  }
}
