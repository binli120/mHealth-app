/**
 * Utility functions for the Check Application page.
 * @author Bin Lee
 */

import type { FormRecord, PersonState, WizardData } from "@/components/application/aca3/types"
import type { WorkflowField } from "./page.types"

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function humanizeToken(token: string): string {
  const normalized = token.replace(/[_-]+/g, " ").trim()
  if (!normalized) {
    return token
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatSegment(segment: string): string {
  if (/^\d+$/.test(segment)) {
    return `Item ${Number(segment) + 1}`
  }

  return humanizeToken(segment)
}

export function formatLeafValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  if (typeof value === "number") {
    return String(value)
  }

  if (typeof value === "string") {
    return value
  }

  return ""
}

export function buildWorkflowField(segments: string[], value: unknown): WorkflowField {
  const path = segments.length > 0 ? segments.join(".") : "root"
  const firstNamed = segments.find((segment) => !/^\d+$/.test(segment))
  const lastNamed = [...segments].reverse().find((segment) => !/^\d+$/.test(segment))
  const containerSegments = segments.slice(0, -1)

  return {
    path,
    section: firstNamed ? humanizeToken(firstNamed) : "General",
    label: lastNamed ? humanizeToken(lastNamed) : "Value",
    hint:
      containerSegments.length > 0
        ? containerSegments.map((segment) => formatSegment(segment)).join(" / ")
        : "General",
    value: formatLeafValue(value),
    rawValue: value,
  }
}

export function flattenWorkflowFields(
  value: unknown,
  segments: string[] = [],
  out: WorkflowField[] = [],
): WorkflowField[] {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push(buildWorkflowField(segments, value))
      return out
    }

    value.forEach((item, index) => {
      flattenWorkflowFields(item, [...segments, String(index)], out)
    })

    return out
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      out.push(buildWorkflowField(segments, value))
      return out
    }

    entries.forEach(([key, item]) => {
      flattenWorkflowFields(item, [...segments, key], out)
    })

    return out
  }

  out.push(buildWorkflowField(segments, value))
  return out
}

export function groupFieldsBySection(fields: WorkflowField[]): Array<{ section: string; fields: WorkflowField[] }> {
  const grouped = new Map<string, WorkflowField[]>()

  fields.forEach((field) => {
    const sectionFields = grouped.get(field.section) ?? []
    sectionFields.push(field)
    grouped.set(field.section, sectionFields)
  })

  return Array.from(grouped.entries()).map(([section, groupedFields]) => ({
    section,
    fields: groupedFields,
  }))
}

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

export function isArrayIndexSegment(segment: string): boolean {
  return /^\d+$/.test(segment)
}

export function setByPath(target: unknown, path: string, value: unknown): void {
  if (!target || typeof target !== "object" || !path || path === "root") {
    return
  }

  const segments = path.split(".")
  let cursor: unknown = target

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const nextSegment = segments[index + 1]

    if (Array.isArray(cursor)) {
      const arrayIndex = Number.parseInt(segment, 10)
      if (!Number.isFinite(arrayIndex) || !cursor[arrayIndex]) {
        cursor[arrayIndex] = isArrayIndexSegment(nextSegment) ? [] : {}
      }
      cursor = cursor[arrayIndex]
      continue
    }

    if (!cursor || typeof cursor !== "object") {
      return
    }

    const record = cursor as Record<string, unknown>
    if (record[segment] === undefined || record[segment] === null) {
      record[segment] = isArrayIndexSegment(nextSegment) ? [] : {}
    }
    cursor = record[segment]
  }

  const lastSegment = segments[segments.length - 1]
  if (Array.isArray(cursor)) {
    const arrayIndex = Number.parseInt(lastSegment, 10)
    if (Number.isFinite(arrayIndex)) {
      cursor[arrayIndex] = value
    }
    return
  }

  if (!cursor || typeof cursor !== "object") {
    return
  }

  ;(cursor as Record<string, unknown>)[lastSegment] = value
}

export function parseEditedValue(rawValue: unknown, input: string): unknown {
  if (Array.isArray(rawValue) || (rawValue && typeof rawValue === "object")) {
    return rawValue
  }

  if (typeof rawValue === "boolean") {
    const normalized = input.trim().toLowerCase()
    if (["yes", "true", "1"].includes(normalized)) {
      return true
    }
    if (["no", "false", "0"].includes(normalized)) {
      return false
    }
    return rawValue
  }

  if (typeof rawValue === "number") {
    const parsed = Number.parseFloat(input)
    return Number.isFinite(parsed) ? parsed : rawValue
  }

  if (rawValue === null || rawValue === undefined) {
    return input
  }

  return input
}

export function applyFieldValuesToWorkflowData(
  workflowData: Record<string, unknown>,
  fields: WorkflowField[],
  values: Record<string, string>,
): Record<string, unknown> {
  const nextWorkflow = deepClone(workflowData)

  fields.forEach((field) => {
    const edited = values[field.path]
    if (edited === undefined) {
      return
    }

    const parsedValue = parseEditedValue(field.rawValue, edited)
    setByPath(nextWorkflow, field.path, parsedValue)
  })

  return nextWorkflow
}

export function asFormRecord(value: unknown): FormRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as FormRecord
}

export function mapPersonState(value: unknown): PersonState {
  const source = asFormRecord(value)

  return {
    identity: asFormRecord(source.ss_identity),
    demographics: asFormRecord(source.ss_demographics),
    ssn: asFormRecord(source.ss_ssn),
    tax: asFormRecord(source.ss_tax),
    coverage: asFormRecord(source.ss_coverage),
    income: asFormRecord(source.ss_income),
    skippedOptional: asFormRecord(source.skippedOptional) as Record<string, boolean>,
  }
}

export function mapWorkflowToWizardData(workflowData: Record<string, unknown>): WizardData {
  const personsRaw = Array.isArray(workflowData.persons) ? workflowData.persons : []
  const persons = personsRaw.map((person) => mapPersonState(person))
  const contact = asFormRecord(workflowData.step1_contact)
  const resolvedPersonCount = Math.max(persons.length, 1)

  if (!contact.p1_num_people) {
    contact.p1_num_people = String(resolvedPersonCount)
  }

  return {
    preApp: asFormRecord(workflowData.pre_application),
    contact,
    assister: asFormRecord(workflowData.enrollment_assister),
    assisterEnabled: Boolean(workflowData.assisterEnabled),
    persons:
      persons.length > 0
        ? persons
        : [
            {
              identity: {},
              demographics: {},
              ssn: {},
              tax: {},
              coverage: {},
              income: {},
              skippedOptional: {},
            },
          ],
    attestation: Boolean(workflowData.attestation),
  }
}

export function inferStepFromErrorKey(errorKey: string): number | null {
  const match = /^step(\d+)\./.exec(errorKey)
  if (!match) {
    return null
  }

  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}
