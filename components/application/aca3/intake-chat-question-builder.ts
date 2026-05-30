/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Pure (no JSX, no hooks) question-queue engine for the ACA-3 intake chat.
 * Extracted from intake-chat.tsx so the question-building logic can be
 * unit-tested in isolation and reused by other modules.
 *
 * Exports:
 *   getQuestionRecord              — FormRecord accessor for a question
 *   updateQuestionRecord           — immutable FormRecord updater
 *   getChecklistSelectedLabels     — human-readable checklist selections
 *   readValue                      — read a question's current value
 *   writeValue                     — write a question's value into WizardData
 *   getAddressSiblingFieldIds      — sibling field IDs for address groups
 *   writeFieldById                 — write a field by explicit ID
 *   getComplexQuestionPrefix       — ID prefix for complex/repeatable questions
 *   createRepeatableCountQuestion  — factory for repeatable count sub-questions
 *   createChecklistSelectionQuestion — factory for checklist selection questions
 *   createChecklistItemField       — factory for checklist item schema fields
 *   collectChecklistQuestions      — expand a checklist field into questions
 *   collectQuestionsFromFields     — walk schema fields → IntakeQuestion list
 *   buildQuestions                 — top-level question list builder
 *   buildContextValuesForQuestion  — context values for conditional evaluation
 *   computeAnsweredQuestionIds     — set of answered question IDs
 *   shouldSkipQuestionInChat       — true if a question should be skipped
 *   findNextPendingQuestion        — finds the next unanswered question
 *   deriveSkippedFromLastAnswered  — infer skipped IDs after answering
 */

import {
  ACA3_SCHEMA,
  MAX_PERSON_COUNT,
  PERSON_SECTION_MAP,
} from "@/lib/constant"
import { evaluateConditionalRule } from "@/hooks/use-conditional"
import type {
  IntakeQuestion,
} from "./intake-chat-types"
import type {
  FieldValue,
  FormRecord,
  PersonSectionKey,
  SchemaField,
  WizardData,
} from "./types"

// ── Re-export types used by external consumers ─────────────────────────────────

export type { IntakeQuestion } from "./intake-chat-types"

// ── AddressSiblingFieldIds ─────────────────────────────────────────────────────

export interface AddressSiblingFieldIds {
  streetId: string
  cityId: string
  stateId: string
  zipId: string
  countyId?: string
}

// ── Skip-set constants ─────────────────────────────────────────────────────────

const OPTIONAL_FIELDS_TO_SKIP_IN_CHAT = new Set<string>([
  "p1_home_apt",
  "p1_home_county",
  "p1_mail_apt",
  "p1_mail_county",
  "sep_apt",
  "sep_county",
  "p1_language_written",
])

// Fields in person_schema.ss_identity that duplicate contact fields for person 0.
const PERSON0_IDENTITY_SKIP_FIELDS = new Set<string>(["name", "dob"])

// ── Internal helpers ───────────────────────────────────────────────────────────

function isUnknownValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value === "string") {
    return value.trim().length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  return false
}

export function isFilledValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === "boolean") {
    return true
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
  }

  return value !== null && value !== undefined
}

function evaluateConditionalRuleForQuestioning(
  rule: SchemaField["show_if"],
  formState: Record<string, unknown>,
): boolean {
  if (!rule) {
    return true
  }

  const current = formState[rule.field]
  if (isUnknownValue(current)) {
    return false
  }

  return evaluateConditionalRule(rule, formState)
}

export function isRequiredInCurrentContext(field: SchemaField, contextValues: Record<string, unknown>): boolean {
  if (typeof field.required_if === "boolean") {
    return Boolean(field.required) || field.required_if
  }

  if (field.required_if) {
    return Boolean(field.required) || evaluateConditionalRule(field.required_if, contextValues)
  }

  return Boolean(field.required)
}

export function validateParsedFieldValue(
  field: SchemaField,
  value: FieldValue,
  contextValues: Record<string, unknown>,
): string | null {
  if (field.type === "checkbox") {
    return typeof value === "boolean" ? null : "Please answer Yes or No."
  }

  const isRequired = isRequiredInCurrentContext(field, contextValues)

  if (isRequired && !isFilledValue(value)) {
    return "This field is required."
  }

  if (!isFilledValue(value)) {
    return null
  }

  if (field.type === "number") {
    const numeric = Number.parseFloat(String(value))
    if (!Number.isFinite(numeric)) {
      return "Please enter a valid number."
    }

    if (field.validation?.min !== undefined && numeric < field.validation.min) {
      return `Value must be at least ${field.validation.min}.`
    }

    if (field.validation?.max !== undefined && numeric > field.validation.max) {
      return `Value must be at most ${field.validation.max}.`
    }
  }

  if (field.type === "checkbox_group") {
    if (!Array.isArray(value)) {
      return "Please provide one or more selections."
    }

    if (field.max_select && value.length > field.max_select) {
      return `Please select at most ${field.max_select} options.`
    }

    if (field.options && value.some((item) => !field.options?.includes(String(item)))) {
      return `Please choose options from: ${field.options.join(", ")}.`
    }
  }

  return null
}

function normalizeScalarFieldValue(field: SchemaField): FieldValue {
  if (field.value !== null && field.value !== undefined) {
    return field.value as FieldValue
  }

  switch (field.type) {
    case "checkbox":
      return null
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
    default:
      return ""
  }
}

function getRepeatableRowDefault(groupSchema: SchemaField[]): Record<string, unknown> {
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

function clampPersonCount(value: unknown): number {
  const parsed = Number.parseInt(String(value || "1"), 10)

  if (!Number.isFinite(parsed)) {
    return 1
  }

  return Math.min(MAX_PERSON_COUNT, Math.max(1, parsed))
}

function makeDefaultPersonState(index: number) {
  const state = {
    identity: {} as FormRecord,
    demographics: {} as FormRecord,
    ssn: {} as FormRecord,
    tax: {} as FormRecord,
    coverage: {} as FormRecord,
    income: {} as FormRecord,
    skippedOptional: {} as FormRecord,
  }

  for (const section of ACA3_SCHEMA.person_schema.sub_sections) {
    const sectionId = section.sub_section_id
    if (!sectionId) {
      continue
    }

    const key = PERSON_SECTION_MAP[sectionId] as PersonSectionKey | undefined
    if (!key) {
      continue
    }

    seedFieldDefaults(section.fields, state[key])

    if (index === 0 && sectionId === "ss_identity") {
      state.identity.relationship_to_p1 = "SELF"
    }
  }

  return state
}

function seedFieldDefaults(fields: SchemaField[], target: FormRecord): void {
  for (const field of fields) {
    if (target[field.id] === undefined) {
      target[field.id] = normalizeScalarFieldValue(field)
    }

    if (field.type === "address_group" && field.fields) {
      seedFieldDefaults(Object.values(field.fields), target)
    }

    if (field.sub_fields) {
      for (const subGroup of Object.values(field.sub_fields)) {
        seedFieldDefaults(subGroup, target)
      }
    }
  }
}

function getActiveSubFields(field: SchemaField, value: unknown): SchemaField[] {
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

// ── Chat-specific initial data ─────────────────────────────────────────────────
// Uses the local seedFieldDefaults / normalizeScalarFieldValue (checkbox → null)
// so that checkbox fields start as "unknown" in the chat flow, not pre-answered.
// wizard-reducer's createInitialData uses false for checkbox, which would mark
// p1_mailing_same as already answered and incorrectly surface mailing fields.

export function createInitialIntakeData(): WizardData {
  const preApp: FormRecord = {}
  const contact: FormRecord = {}
  const assister: FormRecord = {}

  seedFieldDefaults(ACA3_SCHEMA.pre_application.fields, preApp)
  seedFieldDefaults(ACA3_SCHEMA.step1_contact.fields, contact)
  seedFieldDefaults(ACA3_SCHEMA.enrollment_assister.fields, assister)

  const personCount = clampPersonCount(contact.p1_num_people || 1)
  // Cast: local makeDefaultPersonState uses FormRecord for skippedOptional, but
  // PersonState types it as Record<string, boolean>; the values are compatible at runtime.
  const persons = Array.from(
    { length: personCount },
    (_, index) => makeDefaultPersonState(index) as unknown as import("./types").PersonState,
  )

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

// ── Exported question-engine functions ────────────────────────────────────────

export function getQuestionRecord(data: WizardData, question: IntakeQuestion): FormRecord | null {
  if (question.scope === "preApp") {
    return data.preApp
  }

  if (question.scope === "contact") {
    return data.contact
  }

  if (question.scope === "assister") {
    return data.assister
  }

  if (question.scope === "person" && question.sectionKey !== undefined && question.personIndex !== undefined) {
    const person = data.persons[question.personIndex]
    if (!person) {
      return null
    }

    return person[question.sectionKey]
  }

  return null
}

export function updateQuestionRecord(
  data: WizardData,
  question: IntakeQuestion,
  update: (record: FormRecord) => FormRecord,
): WizardData {
  if (question.scope === "preApp") {
    return {
      ...data,
      preApp: update(data.preApp),
    }
  }

  if (question.scope === "contact") {
    return {
      ...data,
      contact: update(data.contact),
    }
  }

  if (question.scope === "assister") {
    return {
      ...data,
      assister: update(data.assister),
    }
  }

  if (question.scope === "person" && question.sectionKey !== undefined && question.personIndex !== undefined) {
    const nextPeople = [...data.persons]
    const person = nextPeople[question.personIndex]

    if (!person) {
      return data
    }

    nextPeople[question.personIndex] = {
      ...person,
      [question.sectionKey]: update(person[question.sectionKey]),
    }

    return {
      ...data,
      persons: nextPeople,
    }
  }

  return data
}

export function getChecklistSelectedLabels(record: FormRecord, question: IntakeQuestion): string[] {
  const complex = question.complex
  if (complex?.kind !== "checklist_selection") {
    return []
  }

  const checklistValue = (record[complex.parentField.id] as Record<string, Record<string, unknown>> | undefined) ?? {}
  const selectedLabels = (complex.parentField.items ?? [])
    .filter((item) => Boolean(checklistValue[item.id]?.selected))
    .map((item) => item.label)

  return record[`${complex.parentField.id}__none_selected`] === true && selectedLabels.length === 0
    ? ["None"]
    : selectedLabels
}

export function readValue(data: WizardData, question: IntakeQuestion): unknown {
  const record = getQuestionRecord(data, question)
  if (!record) return undefined

  const complex = question.complex
  if (!complex) {
    return record[question.field.id]
  }

  if (complex.kind === "repeatable_count") {
    return record[`${complex.parentField.id}__count`]
  }

  if (complex.kind === "repeatable_field") {
    const rows = Array.isArray(record[complex.parentField.id])
      ? record[complex.parentField.id] as Array<Record<string, unknown>>
      : []
    return rows[complex.rowIndex]?.[question.field.id]
  }

  if (complex.kind === "checklist_selection") {
    return getChecklistSelectedLabels(record, question)
  }

  const checklistValue = (record[complex.parentField.id] as Record<string, Record<string, unknown>> | undefined) ?? {}
  return checklistValue[complex.itemId]?.[complex.valueKey]
}

export function writeValue(data: WizardData, question: IntakeQuestion, value: FieldValue): WizardData {
  const complex = question.complex

  if (!complex) {
    return updateQuestionRecord(data, question, (record) => ({
      ...record,
      [question.field.id]: value,
    }))
  }

  if (complex.kind === "repeatable_count") {
    const maxEntries = complex.parentField.max_entries ?? 2
    const nextCount = Math.min(maxEntries, Math.max(0, Number.parseInt(String(value || "0"), 10) || 0))
    return updateQuestionRecord(data, question, (record) => {
      const existingRows = Array.isArray(record[complex.parentField.id])
        ? record[complex.parentField.id] as Array<Record<string, unknown>>
        : []
      const nextRows = existingRows.slice(0, nextCount)
      while (nextRows.length < nextCount) {
        nextRows.push(getRepeatableRowDefault(complex.parentField.group_schema ?? []))
      }

      return {
        ...record,
        [`${complex.parentField.id}__count`]: String(nextCount),
        [complex.parentField.id]: nextRows,
      }
    })
  }

  if (complex.kind === "repeatable_field") {
    return updateQuestionRecord(data, question, (record) => {
      const rows = Array.isArray(record[complex.parentField.id])
        ? [...record[complex.parentField.id] as Array<Record<string, unknown>>]
        : []
      while (rows.length <= complex.rowIndex) {
        rows.push(getRepeatableRowDefault(complex.parentField.group_schema ?? []))
      }

      rows[complex.rowIndex] = {
        ...(rows[complex.rowIndex] ?? {}),
        [question.field.id]: value,
      }

      return {
        ...record,
        [complex.parentField.id]: rows,
      }
    })
  }

  if (complex.kind === "checklist_selection") {
    const selectedLabels = Array.isArray(value) ? value.map((item) => String(item)) : [String(value)]
    const selectedSet = new Set(selectedLabels.map((item) => item.toLowerCase()))
    const noneSelected = selectedSet.has("none")

    return updateQuestionRecord(data, question, (record) => {
      const currentChecklist = (record[complex.parentField.id] as Record<string, Record<string, unknown>> | undefined) ?? {}
      const nextChecklist: Record<string, Record<string, unknown>> = {}

      for (const item of complex.parentField.items ?? []) {
        const selected = !noneSelected && selectedSet.has(item.label.toLowerCase())
        nextChecklist[item.id] = {
          ...(currentChecklist[item.id] ?? {}),
          selected,
        }
      }

      return {
        ...record,
        [`${complex.parentField.id}__none_selected`]: noneSelected,
        [complex.parentField.id]: nextChecklist,
      }
    })
  }

  return updateQuestionRecord(data, question, (record) => {
    const currentChecklist = (record[complex.parentField.id] as Record<string, Record<string, unknown>> | undefined) ?? {}
    return {
      ...record,
      [complex.parentField.id]: {
        ...currentChecklist,
        [complex.itemId]: {
          ...(currentChecklist[complex.itemId] ?? {}),
          selected: true,
          [complex.valueKey]: value,
        },
      },
    }
  })
}

export function getAddressSiblingFieldIds(fieldId: string): AddressSiblingFieldIds | null {
  const match = fieldId.match(/^(.*)_(street|city|state|zip)$/i)
  if (!match?.[1]) {
    return null
  }

  const prefix = match[1]
  return {
    streetId: `${prefix}_street`,
    cityId: `${prefix}_city`,
    stateId: `${prefix}_state`,
    zipId: `${prefix}_zip`,
    countyId: `${prefix}_county`,
  }
}

export function writeFieldById(
  data: WizardData,
  question: IntakeQuestion,
  fieldId: string,
  value: FieldValue,
): WizardData {
  const syntheticField = {
    ...question.field,
    id: fieldId,
  }

  return writeValue(
    data,
    {
      ...question,
      field: syntheticField,
    },
    value,
  )
}

export function getComplexQuestionPrefix(
  target: Pick<IntakeQuestion, "scope" | "sectionKey" | "personIndex">,
  parentFieldId: string,
): string {
  if (target.scope === "person") {
    return `complex:person:${target.personIndex ?? 0}:${target.sectionKey ?? ""}:${parentFieldId}`
  }

  return `complex:${target.scope}:${parentFieldId}`
}

export function createRepeatableCountQuestion(
  field: SchemaField,
  target: Pick<IntakeQuestion, "scope" | "sectionKey" | "personIndex">,
): IntakeQuestion {
  const maxEntries = field.max_entries ?? 2
  return {
    id: `${getComplexQuestionPrefix(target, field.id)}:count`,
    field: {
      id: `${field.id}__count`,
      label: field.label,
      type: "number",
      required: false,
      validation: { min: 0, max: maxEntries },
    },
    ...target,
    complex: {
      kind: "repeatable_count",
      parentField: field,
    },
  }
}

export function createChecklistSelectionQuestion(
  field: SchemaField,
  target: Pick<IntakeQuestion, "scope" | "sectionKey" | "personIndex">,
): IntakeQuestion {
  const itemLabels = (field.items ?? []).map((item) => item.label)
  const hasNoneOption = itemLabels.some((label) => label.toLowerCase() === "none")

  return {
    id: `${getComplexQuestionPrefix(target, field.id)}:selected`,
    field: {
      id: `${field.id}__selected`,
      label: field.label,
      hint: field.hint,
      type: "checkbox_group",
      required: false,
      options: hasNoneOption ? itemLabels : [...itemLabels, "None"],
    },
    ...target,
    complex: {
      kind: "checklist_selection",
      parentField: field,
    },
  }
}

export function createChecklistItemField(itemLabel: string, valueKey: string): SchemaField {
  if (valueKey === "amount") {
    return { id: valueKey, label: `${itemLabel}: amount`, type: "currency", required: true }
  }

  if (valueKey === "yearly_amount") {
    return { id: valueKey, label: `${itemLabel}: yearly amount`, type: "currency", required: true }
  }

  if (valueKey === "frequency") {
    return {
      id: valueKey,
      label: `${itemLabel}: frequency`,
      type: "select",
      required: true,
      options: ["One time only", "Weekly", "Every two weeks", "Twice a month", "Monthly", "Yearly"],
    }
  }

  if (valueKey === "profit_or_loss") {
    return { id: valueKey, label: `${itemLabel}: profit or loss`, type: "radio", required: true, options: ["Profit", "Loss"] }
  }

  if (valueKey === "hours_per_week") {
    return { id: valueKey, label: `${itemLabel}: hours per week`, type: "number", required: true }
  }

  if (valueKey === "effective_date") {
    return { id: valueKey, label: `${itemLabel}: effective date`, type: "date", required: true }
  }

  return { id: valueKey, label: `${itemLabel}: ${valueKey.replaceAll("_", " ")}`, type: "text", required: true }
}

export function collectChecklistQuestions(params: {
  field: SchemaField
  data: WizardData
  target: Pick<IntakeQuestion, "scope" | "sectionKey" | "personIndex">
  result: IntakeQuestion[]
}) {
  const { field, data, target, result } = params
  const selectionQuestion = createChecklistSelectionQuestion(field, target)
  result.push(selectionQuestion)

  const record = getQuestionRecord(data, selectionQuestion)
  if (!record) return

  const selectedLabels = new Set(getChecklistSelectedLabels(record, selectionQuestion))
  if (selectedLabels.size === 0 || selectedLabels.has("None")) return

  for (const item of field.items ?? []) {
    if (!selectedLabels.has(item.label)) continue
    if (field.type === "deduction_checklist" && item.id === "ded_none") continue

    const valueKeys = field.type === "deduction_checklist"
      ? ["yearly_amount"]
      : ["amount", "frequency", ...(item.extra_fields ?? []).filter((key) => key !== "frequency")]

    for (const valueKey of valueKeys) {
      result.push({
        id: `${getComplexQuestionPrefix(target, field.id)}:${item.id}:${valueKey}`,
        field: createChecklistItemField(item.label, valueKey),
        ...target,
        complex: {
          kind: "checklist_item_field",
          parentField: field,
          itemId: item.id,
          valueKey,
        },
      })
    }
  }
}

export function collectQuestionsFromFields(params: {
  fields: SchemaField[]
  contextValues: Record<string, unknown>
  data: WizardData
  target: Pick<IntakeQuestion, "scope" | "sectionKey" | "personIndex">
  result: IntakeQuestion[]
  repeatableContext?: {
    parentField: SchemaField
    rowIndex: number
  }
}) {
  const { fields, contextValues, data, target, result, repeatableContext } = params

  for (const field of fields) {
    const personNumber = target.scope === "person" ? Number(target.personIndex ?? 0) + 1 : 1

    if (field.applicable_from_person && personNumber < field.applicable_from_person) {
      continue
    }

    if (field.show_if && !evaluateConditionalRuleForQuestioning(field.show_if, contextValues)) {
      continue
    }

    if (field.type === "repeatable_group") {
      const countQuestion = createRepeatableCountQuestion(field, target)
      result.push(countQuestion)

      const record = getQuestionRecord(data, countQuestion)
      const countAnswered = record?.[`${field.id}__count`]
      const rows = Array.isArray(record?.[field.id])
        ? record[field.id] as Array<Record<string, unknown>>
        : []

      if (isFilledValue(countAnswered)) {
        rows.forEach((row, rowIndex) => {
          collectQuestionsFromFields({
            fields: field.group_schema ?? [],
            contextValues: {
              ...contextValues,
              ...row,
            },
            data,
            target,
            result,
            repeatableContext: {
              parentField: field,
              rowIndex,
            },
          })
        })
      }
      continue
    }

    if (field.type === "income_checklist" || field.type === "deduction_checklist") {
      collectChecklistQuestions({ field, data, target, result })
      continue
    }

    if (field.type === "address_group" && field.fields) {
      collectQuestionsFromFields({
        fields: Object.values(field.fields),
        contextValues,
        data,
        target,
        result,
        repeatableContext,
      })
      continue
    }

    const question: IntakeQuestion = {
      id: repeatableContext
        ? `${getComplexQuestionPrefix(target, repeatableContext.parentField.id)}:${repeatableContext.rowIndex}:${field.id}`
        : target.scope === "person"
          ? `person:${target.personIndex ?? 0}:${target.sectionKey ?? ""}:${field.id}`
          : `${target.scope}:${field.id}`,
      field,
      scope: target.scope,
      sectionKey: target.sectionKey,
      personIndex: target.personIndex,
      ...(repeatableContext
        ? {
            complex: {
              kind: "repeatable_field" as const,
              parentField: repeatableContext.parentField,
              rowIndex: repeatableContext.rowIndex,
            },
          }
        : {}),
    }
    result.push(question)

    const currentValue = (() => {
      const syntheticQuestion: IntakeQuestion = {
        id: "",
        field,
        scope: target.scope,
        sectionKey: target.sectionKey,
        personIndex: target.personIndex,
        complex: question.complex,
      }
      return readValue(data, syntheticQuestion)
    })()

    const activeSubFields = getActiveSubFields(field, currentValue)
    if (activeSubFields.length > 0) {
      const nextContextValues = {
        ...contextValues,
        [field.id]: currentValue,
      }

      collectQuestionsFromFields({
        fields: activeSubFields,
        contextValues: nextContextValues,
        data,
        target,
        result,
        repeatableContext,
      })
    }
  }
}

export function buildQuestions(data: WizardData): IntakeQuestion[] {
  const questions: IntakeQuestion[] = []

  collectQuestionsFromFields({
    fields: ACA3_SCHEMA.step1_contact.fields,
    contextValues: {
      ...data.preApp,
      ...data.contact,
    },
    data,
    target: {
      scope: "contact",
    },
    result: questions,
  })

  const personCount = clampPersonCount(data.contact.p1_num_people || data.persons.length || 1)

  for (let personIndex = 0; personIndex < personCount; personIndex += 1) {
    const person = data.persons[personIndex] ?? makeDefaultPersonState(personIndex)
    const contextValues = {
      ...data.preApp,
      ...data.contact,
      ...person.identity,
      ...person.demographics,
      ...person.ssn,
      ...person.tax,
      ...person.coverage,
      ...person.income,
    }

    for (const section of ACA3_SCHEMA.person_schema.sub_sections) {
      const sectionId = section.sub_section_id
      if (!sectionId) {
        continue
      }

      const sectionKey = PERSON_SECTION_MAP[sectionId]
      if (!sectionKey) {
        continue
      }

      collectQuestionsFromFields({
        fields: section.fields,
        contextValues,
        data,
        target: {
          scope: "person",
          personIndex,
          sectionKey,
        },
        result: questions,
      })
    }
  }

  collectQuestionsFromFields({
    fields: ACA3_SCHEMA.pre_application.fields,
    contextValues: {
      ...data.preApp,
      ...data.contact,
    },
    data,
    target: {
      scope: "preApp",
    },
    result: questions,
  })

  return questions
}

export function buildContextValuesForQuestion(data: WizardData, question: IntakeQuestion): Record<string, unknown> {
  if (question.scope === "person" && question.personIndex !== undefined) {
    return {
      ...data.preApp,
      ...data.contact,
      ...(data.persons[question.personIndex]?.identity ?? {}),
      ...(data.persons[question.personIndex]?.demographics ?? {}),
      ...(data.persons[question.personIndex]?.ssn ?? {}),
      ...(data.persons[question.personIndex]?.tax ?? {}),
      ...(data.persons[question.personIndex]?.coverage ?? {}),
      ...(data.persons[question.personIndex]?.income ?? {}),
    }
  }

  return {
    ...data.preApp,
    ...data.contact,
    ...data.assister,
  }
}

export function computeAnsweredQuestionIds(questions: IntakeQuestion[], data: WizardData): Set<string> {
  const answered = new Set<string>()

  for (const question of questions) {
    const value = readValue(data, question) as FieldValue
    const contextValues = buildContextValuesForQuestion(data, question)
    const error = validateParsedFieldValue(question.field, value, contextValues)

    if (!error && isFilledValue(value)) {
      answered.add(question.id)
    }
  }

  return answered
}

export function shouldSkipQuestionInChat(question: IntakeQuestion, data: WizardData): boolean {
  const contextValues = buildContextValuesForQuestion(data, question)
  const isRequired = isRequiredInCurrentContext(question.field, contextValues)

  if (!isRequired && OPTIONAL_FIELDS_TO_SKIP_IN_CHAT.has(question.field.id)) {
    return true
  }

  // Skip name/dob in person 0 identity section — they duplicate p1_name/p1_dob from contact.
  if (
    question.scope === "person" &&
    question.personIndex === 0 &&
    question.sectionKey === "identity" &&
    PERSON0_IDENTITY_SKIP_FIELDS.has(question.field.id)
  ) {
    return true
  }

  return false
}

export function findNextPendingQuestion(
  questions: IntakeQuestion[],
  answeredQuestionIds: Set<string>,
  data: WizardData,
  skippedQuestionIds: Set<string>,
): IntakeQuestion | null {
  for (const question of questions) {
    if (answeredQuestionIds.has(question.id)) {
      continue
    }

    if (skippedQuestionIds.has(question.id)) {
      continue
    }

    if (shouldSkipQuestionInChat(question, data)) {
      continue
    }

    return question
  }

  return null
}

export function getWizardStepForQuestion(question: IntakeQuestion): number {
  if (question.scope === "preApp") {
    return 1
  }

  if (question.scope === "contact" || question.scope === "assister") {
    return 2
  }

  if (question.scope === "person") {
    switch (question.sectionKey) {
      case "identity":
        return question.personIndex && question.personIndex > 0 ? 3 : 2
      case "demographics":
      case "ssn":
        return 4
      case "tax":
        return 5
      case "coverage":
        return 6
      case "income":
        return 7
      default:
        return 2
    }
  }

  return 1
}

export function getWizardStepForIntakeProgress(
  questions: IntakeQuestion[],
  answeredQuestionIds: Set<string>,
  data: WizardData,
  skippedQuestionIds: Set<string>,
): number {
  const nextQuestion = findNextPendingQuestion(questions, answeredQuestionIds, data, skippedQuestionIds)
  return nextQuestion ? getWizardStepForQuestion(nextQuestion) : 8
}

/**
 * On resume, any unanswered optional question that precedes the last answered
 * question was clearly seen and skipped in a prior session.  Mark it skipped so
 * the user doesn't get sent back to it.  This handles legacy sessions that were
 * saved before chatSkippedIds persistence was added.
 */
export function deriveSkippedFromLastAnswered(
  questions: IntakeQuestion[],
  answeredIds: Set<string>,
  data: WizardData,
  baseSkipped: Set<string>,
): Set<string> {
  let lastAnsweredIndex = -1
  for (let i = questions.length - 1; i >= 0; i--) {
    if (answeredIds.has(questions[i].id)) {
      lastAnsweredIndex = i
      break
    }
  }
  if (lastAnsweredIndex < 0) return new Set(baseSkipped)

  const result = new Set(baseSkipped)
  for (let i = 0; i < lastAnsweredIndex; i++) {
    const q = questions[i]
    if (answeredIds.has(q.id) || result.has(q.id) || shouldSkipQuestionInChat(q, data)) continue
    const contextValues = buildContextValuesForQuestion(data, q)
    if (!isRequiredInCurrentContext(q.field, contextValues)) {
      result.add(q.id)
    }
  }
  return result
}
