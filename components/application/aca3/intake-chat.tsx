/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  type IntakeChatCopy,
  IntakeChatPanel,
} from "@/components/application/aca3/intake-chat-panel"
import {
  type IntakeMessage,
  splitTrailingQuestion,
} from "@/components/application/aca3/intake-chat-message-bubble"

import {
  ACA3_SCHEMA,
  DOB_FIELD_PATTERN,
  EMAIL_PATTERN,
  MAX_PERSON_COUNT,
  PERSON_SECTION_MAP,
  SSN_PATTERN,
} from "@/lib/constant"
import { useRouter } from "next/navigation"
import { isSupportedLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { setApplicationWizardState, DEFAULT_APPLICATION_ID } from "@/lib/redux/features/application-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import { formatCurrency, formatPhoneNumber, formatSsn, parseCurrency } from "@/lib/utils/input-format"
import { createUuid } from "@/lib/utils/random-id"
import { normalizeNumberInput, parseDate, validateDobBounds } from "@/lib/utils/aca3-form"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import { countHouseholdRelationshipMentions } from "@/lib/masshealth/household-relationships"
import { evaluateConditionalRule } from "@/hooks/use-conditional"
import { type WidgetSpec, } from "@/components/application/aca3/intake-question-widget"
import type {
  AddressValidationResponse,
  FieldValue,
  FormRecord,
  PersonSectionKey,
  PersonState,
  SchemaField,
  WizardData,
  WizardState,
} from "@/components/application/aca3/types"

interface ChatApiResponse {
  ok: boolean
  outOfScope?: boolean
  reply?: string
}

interface IntakeChatProps {
  applicationId?: string
  actingForPatientId?: string
  onSwitchToWizard: () => void
  onSaveAndExit?: () => void
}

interface RepeatableCountQuestion {
  kind: "repeatable_count"
  parentField: SchemaField
}

interface RepeatableFieldQuestion {
  kind: "repeatable_field"
  parentField: SchemaField
  rowIndex: number
}

interface ChecklistSelectionQuestion {
  kind: "checklist_selection"
  parentField: SchemaField
}

interface ChecklistItemFieldQuestion {
  kind: "checklist_item_field"
  parentField: SchemaField
  itemId: string
  valueKey: string
}

type IntakeQuestionComplex =
  | RepeatableCountQuestion
  | RepeatableFieldQuestion
  | ChecklistSelectionQuestion
  | ChecklistItemFieldQuestion

interface IntakeQuestion {
  id: string
  field: SchemaField
  scope: "preApp" | "contact" | "assister" | "person"
  sectionKey?: PersonSectionKey
  personIndex?: number
  complex?: IntakeQuestionComplex
}

const SPOKEN_LANGUAGE_TO_CODE: Record<string, SupportedLanguage> = {
  chinese: "zh-CN",
  mandarin: "zh-CN",
  cantonese: "zh-CN",
  "simplified chinese": "zh-CN",
  "traditional chinese": "zh-CN",
  spanish: "es",
  español: "es",
  portuguese: "pt-BR",
  "haitian creole": "ht",
  haitian: "ht",
  creole: "ht",
  vietnamese: "vi",
}

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

const FRIENDLY_QUESTION_OVERRIDES: Record<string, string> = {
  p1_name: "Let's start with your full name (first and last).",
  p1_dob: "What is your date of birth?",
  p1_no_home_address: "Do you currently have a home address?",
  p1_home_street: "What is your home street address?",
  p1_home_city: "What city do you live in?",
  p1_home_state: "What state do you live in?",
  p1_home_zip: "What is your 5-digit ZIP code?",
  p1_mailing_same: "Is your mailing address the same as your home address?",
  p1_mail_street: "What is your mailing street address?",
  p1_mail_city: "What is your mailing city?",
  p1_mail_state: "What is your mailing state?",
  p1_mail_zip: "What is your mailing ZIP code?",
  p1_phone: "What is your main phone number?",
  p1_other_phone: "Do you want to add another phone number?",
  p1_email: "Do you have an email address for notices? If yes, what is it?",
  p1_num_people: "How many people are on this application (1-8)?",
  sex_at_birth: "What sex were you assigned at birth?",
  gender_identity: "How do you describe your current gender identity?",
  sexual_orientation: "How do you describe your sexual orientation?",
  race: "How do you identify your race? You may list multiple values separated by commas.",
  ethnicity: "What is your ethnicity?\n1. Hispanic or Latino\n2. Not Hispanic or Latino\n3. Choose not to answer\nEnter a number or type your answer.",
  has_income: "Do you currently have any income?",
  total_income_current_year: "What is your total expected income for this calendar year?",
  total_income_next_year: "What is your total expected income for next calendar year, if different?",
}

const UI_COPY: Record<SupportedLanguage, IntakeChatCopy> = {
  en: {
    title: "Application Intake Chat",
    subtitle: "Chat will ask the same schema-backed questions as the wizard flow.",
    openingMemoPrompt: "Could you tell me about yourself and your household in a few sentences?",
    switchToWizard: "Switch to Form Wizard",
    placeholder: "Type your answer...",
    saving: "Saving...",
    send: "Send",
    resetChat: "Reset chat",
    autoPlay: "Auto-play question",
    complete: "All intake questions are complete. You can switch to Form Wizard to review and submit.",
    savedPrefix: "Thanks",
  },
  es: {
    title: "Chat de Solicitud",
    subtitle: "El chat hace las mismas preguntas del esquema que el asistente por pasos.",
    openingMemoPrompt: "¿Puede contarme sobre usted y su hogar en unas frases?",
    switchToWizard: "Cambiar a Formulario",
    placeholder: "Escriba su respuesta...",
    saving: "Guardando...",
    send: "Enviar",
    resetChat: "Reiniciar chat",
    autoPlay: "Reproducir pregunta automáticamente",
    complete: "Todas las preguntas de admisión están completas. Puede cambiar al formulario para revisar y enviar.",
    savedPrefix: "Gracias",
  },
  "pt-BR": {
    title: "Chat de Inscrição",
    subtitle: "O chat faz as mesmas perguntas baseadas no esquema do formulário.",
    openingMemoPrompt: "Você pode me contar sobre você e sua família em algumas frases?",
    switchToWizard: "Mudar para Formulário",
    placeholder: "Digite sua resposta...",
    saving: "Salvando...",
    send: "Enviar",
    resetChat: "Reiniciar chat",
    autoPlay: "Reproduzir pergunta automaticamente",
    complete: "Todas as perguntas foram concluídas. Você pode ir ao formulário para revisar e enviar.",
    savedPrefix: "Obrigado",
  },
  "zh-CN": {
    title: "申请聊天",
    subtitle: "聊天会按与表单向导相同的字段提问。",
    openingMemoPrompt: "请先用几句话介绍您自己和您的家庭情况，可以吗？",
    switchToWizard: "切换到表单向导",
    placeholder: "请输入您的回答...",
    saving: "正在保存...",
    send: "发送",
    resetChat: "重置聊天",
    autoPlay: "自动朗读问题",
    complete: "所有采集问题已完成。您可以切换到表单向导进行检查并提交。",
    savedPrefix: "谢谢",
  },
  ht: {
    title: "Chat Aplikasyon",
    subtitle: "Chat la ap poze menm kestyon ki nan form wizard la.",
    openingMemoPrompt: "Èske ou ka rakonte m sou ou menm ak moun lakay ou an kèk fraz?",
    switchToWizard: "Chanje pou Form Wizard",
    placeholder: "Ekri repons ou...",
    saving: "Ap sove...",
    send: "Voye",
    resetChat: "Rekòmanse chat",
    autoPlay: "Li kestyon an otomatikman",
    complete: "Tout kestyon yo fini. Ou ka chanje nan Form Wizard pou revize epi soumèt.",
    savedPrefix: "Mèsi",
  },
  vi: {
    title: "Chat Đơn Đăng Ký",
    subtitle: "Chat sẽ hỏi cùng bộ câu hỏi theo schema như form-wizard.",
    openingMemoPrompt: "Bạn có thể giới thiệu về bản thân và hộ gia đình của bạn trong vài câu không?",
    switchToWizard: "Chuyển sang Form Wizard",
    placeholder: "Nhập câu trả lời của bạn...",
    saving: "Đang lưu...",
    send: "Gửi",
    resetChat: "Đặt lại chat",
    autoPlay: "Tự phát câu hỏi",
    complete: "Đã hoàn thành các câu hỏi thu thập. Bạn có thể chuyển sang form-wizard để rà soát và nộp.",
    savedPrefix: "Cảm ơn",
  },
}

function createMessageId() {
  return createUuid()
}

function normalizeTwoDigitYear(year: number): number {
  const now = new Date()
  const currentTwoDigitYear = now.getFullYear() % 100

  if (year <= currentTwoDigitYear + 1) {
    return 2000 + year
  }

  return 1900 + year
}

function toUsDateString(month: number, day: number, year: number): string | null {
  const normalizedYear = year < 100 ? normalizeTwoDigitYear(year) : year
  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  const yyyy = String(normalizedYear)
  const candidate = `${mm}/${dd}/${yyyy}`
  return parseDate(candidate) ? candidate : null
}

function normalizeFlexibleDateInput(input: string): string | null {
  const value = input.trim()
  if (!value) {
    return null
  }

  const monthNameMatch = value.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{2}|\d{4})$/i,
  )
  if (monthNameMatch) {
    const monthToken = monthNameMatch[1].toLowerCase()
    const monthIndex = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ].findIndex((token) => monthToken.startsWith(token))

    if (monthIndex >= 0) {
      const day = Number.parseInt(monthNameMatch[2], 10)
      const year = Number.parseInt(monthNameMatch[3], 10)
      return toUsDateString(monthIndex + 1, day, year)
    }
  }

  const numericMatch = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/)
  if (numericMatch) {
    const month = Number.parseInt(numericMatch[1], 10)
    const day = Number.parseInt(numericMatch[2], 10)
    const year = Number.parseInt(numericMatch[3], 10)
    return toUsDateString(month, day, year)
  }

  if (/^\d{8}$/.test(value)) {
    const month = Number.parseInt(value.slice(0, 2), 10)
    const day = Number.parseInt(value.slice(2, 4), 10)
    const year = Number.parseInt(value.slice(4, 8), 10)
    return toUsDateString(month, day, year)
  }

  return null
}

function extractLikelyDateFromText(text: string): string | null {
  const monthNameMatch = text.match(
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s+\d{2,4}\b/i,
  )
  if (monthNameMatch?.[0]) {
    return monthNameMatch[0]
  }

  const numericMatch = text.match(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/)
  if (numericMatch?.[0]) {
    return numericMatch[0]
  }

  return null
}

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

function isFilledValue(value: unknown): boolean {
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

function isRequiredInCurrentContext(field: SchemaField, contextValues: Record<string, unknown>): boolean {
  if (typeof field.required_if === "boolean") {
    return Boolean(field.required) || field.required_if
  }

  if (field.required_if) {
    return Boolean(field.required) || evaluateConditionalRule(field.required_if, contextValues)
  }

  return Boolean(field.required)
}

function validateParsedFieldValue(
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

  if (field.type === "text" && /first name/i.test(field.label) && /last name/i.test(field.label)) {
    return hasFirstAndLastName(String(value)) ? null : "Please enter first and last name."
  }

  if (field.type === "email") {
    return EMAIL_PATTERN.test(String(value).trim()) ? null : "Please enter a valid email address."
  }

  if (field.type === "phone") {
    const digits = String(value).replace(/\D/g, "")
    return digits.length === 10 ? null : "Please enter a 10-digit US phone number."
  }

  if (field.type === "ssn") {
    return SSN_PATTERN.test(String(value)) ? null : "Please use SSN format ###-##-####."
  }

  if (field.type === "zip") {
    return /^\d{5}$/.test(String(value)) ? null : "ZIP code must be exactly 5 digits."
  }

  if (field.type === "date") {
    const normalizedDate = normalizeFlexibleDateInput(String(value))
    if (!normalizedDate) {
      return "Please enter a valid date, for example Jan 29 1980 or 7/12/1980."
    }

    const parsedDate = parseDate(normalizedDate)
    if (!parsedDate) {
      return "Please enter a real calendar date."
    }

    if (DOB_FIELD_PATTERN.test(field.id)) {
      const boundsError = validateDobBounds(parsedDate)
      if (boundsError) {
        return boundsError
      }
    }
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

  if (field.type === "currency") {
    const numeric = parseCurrency(String(value))
    if (!Number.isFinite(numeric) || numeric < 0) {
      return "Please enter a valid non-negative amount."
    }
  }

  if ((field.type === "radio" || field.type === "select") && field.options && field.options.length > 0) {
    return field.options.includes(String(value))
      ? null
      : `Please choose one of: ${field.options.join(", ")}.`
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

function makeDefaultPersonState(index: number): PersonState {
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
    if (!sectionId) {
      continue
    }

    const key = PERSON_SECTION_MAP[sectionId]
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

function clampPersonCount(value: unknown): number {
  const parsed = Number.parseInt(String(value || "1"), 10)

  if (!Number.isFinite(parsed)) {
    return 1
  }

  return Math.min(MAX_PERSON_COUNT, Math.max(1, parsed))
}

function ensurePersonCount(data: WizardData, count: number): WizardData {
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

function createInitialData(): WizardData {
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

function createDraftWizardState(data: WizardData, currentStep = 1): WizardState {
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

function normalizeYesNo(input: string): boolean | null {
  const normalized = input.trim().toLowerCase()

  const yesValues = new Set(["yes", "y", "true", "si", "sí", "sim", "wi", "co", "có", "是"])
  const noValues = new Set(["no", "n", "false", "nao", "não", "non", "khong", "không", "否"])

  if (yesValues.has(normalized)) {
    return true
  }

  if (noValues.has(normalized)) {
    return false
  }

  return null
}

// Maps common natural-language relationship phrases to canonical option values.
const RELATIONSHIP_SYNONYMS: Record<string, string> = {
  wife: "Spouse",
  husband: "Spouse",
  spouse: "Spouse",
  partner: "Domestic Partner",
  "domestic partner": "Domestic Partner",
  boyfriend: "Domestic Partner",
  girlfriend: "Domestic Partner",
  son: "Child",
  daughter: "Child",
  kid: "Child",
  child: "Child",
  stepson: "Stepchild",
  stepdaughter: "Stepchild",
  stepchild: "Stepchild",
  dad: "Parent",
  father: "Parent",
  mom: "Parent",
  mother: "Parent",
  parent: "Parent",
  stepdad: "Stepparent",
  stepfather: "Stepparent",
  stepmom: "Stepparent",
  stepmother: "Stepparent",
  stepparent: "Stepparent",
  brother: "Sibling",
  sister: "Sibling",
  sibling: "Sibling",
  grandson: "Grandchild",
  granddaughter: "Grandchild",
  grandchild: "Grandchild",
  grandfather: "Grandparent",
  grandmother: "Grandparent",
  grandparent: "Grandparent",
  uncle: "Aunt/Uncle",
  aunt: "Aunt/Uncle",
  nephew: "Niece/Nephew",
  niece: "Niece/Nephew",
}

function normalizeOptionValue(input: string, options: string[] | undefined): string {
  const source = input.trim()

  if (!options || options.length === 0) {
    return source
  }

  const yesNo = normalizeYesNo(source)
  if (yesNo !== null) {
    const yesOption = options.find((option) => option.toLowerCase() === "yes")
    const noOption = options.find((option) => option.toLowerCase() === "no")

    if (yesNo && yesOption) {
      return yesOption
    }

    if (!yesNo && noOption) {
      return noOption
    }
  }

  const lower = source.toLowerCase()
  const exact = options.find((option) => option.toLowerCase() === lower)
  if (exact) {
    return exact
  }

  // Expand relationship synonyms before partial matching.
  for (const [phrase, canonical] of Object.entries(RELATIONSHIP_SYNONYMS)) {
    if (lower === phrase || lower.includes(`my ${phrase}`) || lower.startsWith(`${phrase} `)) {
      const matched = options.find((o) => o.toLowerCase() === canonical.toLowerCase())
      if (matched) return matched
    }
  }

  // Match options that start with the user's input word-for-word (e.g. "Straight" → "Straight or heterosexual").
  const prefixMatch = options.find((option) => {
    const optLower = option.toLowerCase()
    if (!optLower.startsWith(lower)) return false
    return optLower.length === lower.length || !/[a-z0-9]/i.test(option[lower.length])
  })
  if (prefixMatch) return prefixMatch

  const partial = options.find((option) => lower.includes(option.toLowerCase()))
  if (partial) {
    return partial
  }

  return source
}

function parseCheckboxGroupValues(input: string, options: string[] | undefined): string[] {
  const source = input.trim()

  // Handle numeric selections: "1", "2, 3", "1 and 3".
  if (options && options.length > 0) {
    const parts = source.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length > 0 && parts.every((p) => /^\d+$/.test(p))) {
      const selected: string[] = []
      for (const part of parts) {
        const idx = Number.parseInt(part, 10) - 1
        if (idx >= 0 && idx < options.length) {
          selected.push(options[idx])
        }
      }
      if (selected.length > 0) return selected
    }
  }

  if (options && options.length > 0) {
    const exact = options.find((option) => option.toLowerCase() === source.toLowerCase())
    if (exact) return [exact]
  }

  const chunks = input
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (!options || options.length === 0) {
    return chunks
  }

  const mapped = new Set<string>()
  for (const chunk of chunks) {
    mapped.add(normalizeOptionValue(chunk, options))
  }

  return Array.from(mapped)
}

function formatQuestionPrompt(question: IntakeQuestion): string {
  const field = question.field
  const personPrefix = question.scope === "person" ? `Person ${Number(question.personIndex ?? 0) + 1}: ` : ""
  const baseLabel = FRIENDLY_QUESTION_OVERRIDES[field.id] ?? field.label

  if (question.complex?.kind === "repeatable_count") {
    const maxEntries = question.complex.parentField.max_entries ?? 2
    return `${personPrefix}${question.complex.parentField.label}: how many entries do you want to add? Enter 0 if none, up to ${maxEntries}.`
  }

  if (question.complex?.kind === "checklist_selection") {
    const numbered = (field.options ?? []).map((opt, i) => `${i + 1}. ${opt}`).join("\n")
    const hint = numbered ? `\n${numbered}\nEnter number(s) separated by commas, or type "None".` : ' Type "None" if none apply.'
    return `${personPrefix}${field.label}${hint}`
  }

  if (field.type === "checkbox") {
    return `${personPrefix}${baseLabel} Please answer Yes or No?`
  }

  if (field.type === "checkbox_group") {
    const numbered = (field.options ?? []).map((opt, i) => `${i + 1}. ${opt}`).join("\n")
    const hint = numbered ? `\n${numbered}\nEnter number(s) separated by commas, or type your answer.` : " What are your selections?"
    return `${personPrefix}${baseLabel}${hint}`
  }

  if (field.options && field.options.length > 0) {
    return `${personPrefix}${baseLabel} Options: ${field.options.join(", ")}. What is your answer?`
  }

  if (baseLabel.endsWith("?")) {
    return `${personPrefix}${baseLabel}`
  }

  return `${personPrefix}${baseLabel}${field.hint ? ` (${field.hint})` : ""}`
}

function resolveSpeechLanguage(language: SupportedLanguage): string {
  if (language === "zh-CN") {
    return "zh-CN"
  }

  if (language === "pt-BR") {
    return "pt-BR"
  }

  if (language === "ht") {
    return "ht-HT"
  }

  if (language === "vi") {
    return "vi-VN"
  }

  if (language === "es") {
    return "es-ES"
  }

  return "en-US"
}

function toSpeakableQuestionText(text: string): string {
  return text
    .replace(/\(\s*MM\/DD\/YYYY\s*\)/gi, "")
    .replace(/\bMM\/DD\/YYYY\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\?/g, "?")
    .trim()
}

function getQuestionRecord(data: WizardData, question: IntakeQuestion): FormRecord | null {
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

function updateQuestionRecord(
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

function getChecklistSelectedLabels(record: FormRecord, question: IntakeQuestion): string[] {
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

function readValue(data: WizardData, question: IntakeQuestion): unknown {
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

function writeValue(data: WizardData, question: IntakeQuestion, value: FieldValue): WizardData {
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

interface AddressSiblingFieldIds {
  streetId: string
  cityId: string
  stateId: string
  zipId: string
  countyId?: string
}

function getAddressSiblingFieldIds(fieldId: string): AddressSiblingFieldIds | null {
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

function writeFieldById(
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

interface AddressAutofillResult {
  data: WizardData
  filledFieldIds: string[]
  validationError: string | null
  validationNote: string | null
}

async function applyAddressAutofillFromAnswer(
  data: WizardData,
  question: IntakeQuestion,
  answer: string,
): Promise<AddressAutofillResult> {
  if (question.field.type !== "text" || !question.field.id.toLowerCase().endsWith("_street")) {
    return {
      data,
      filledFieldIds: [],
      validationError: null,
      validationNote: null,
    }
  }

  const parsed = parsePastedUsAddress(answer)
  if (!parsed) {
    return {
      data,
      filledFieldIds: [],
      validationError: null,
      validationNote: null,
    }
  }

  const siblingIds = getAddressSiblingFieldIds(question.field.id)
  if (!siblingIds) {
    return {
      data,
      filledFieldIds: [],
      validationError: null,
      validationNote: null,
    }
  }

  let nextData = data
  nextData = writeFieldById(nextData, question, siblingIds.streetId, parsed.streetAddress)
  nextData = writeFieldById(nextData, question, siblingIds.cityId, parsed.city)
  nextData = writeFieldById(nextData, question, siblingIds.stateId, parsed.state)
  nextData = writeFieldById(nextData, question, siblingIds.zipId, parsed.zipCode)

  try {
    const response = await authenticatedFetch("/api/address/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        streetAddress: parsed.streetAddress,
        city: parsed.city,
        state: parsed.state,
        zipCode: parsed.zipCode,
      }),
    })

    const result = (await response.json()) as AddressValidationResponse
    if (!response.ok || !result.ok) {
      return {
        data: nextData,
        filledFieldIds: [],
        validationError: "I couldn't validate that address right now. Please try the address again.",
        validationNote: null,
      }
    }

    if (!result.valid && !result.suggestion) {
      return {
        data: nextData,
        filledFieldIds: [],
        validationError: result.message || "I could not validate that address. Please re-enter it.",
        validationNote: null,
      }
    }

    if (result.suggestion) {
      const suggestion = result.suggestion
      nextData = writeFieldById(nextData, question, siblingIds.streetId, suggestion.streetAddress.trim())
      nextData = writeFieldById(nextData, question, siblingIds.cityId, suggestion.city.trim())
      nextData = writeFieldById(nextData, question, siblingIds.stateId, suggestion.state.trim().toUpperCase())
      nextData = writeFieldById(
        nextData,
        question,
        siblingIds.zipId,
        suggestion.zipCode.replace(/\D/g, "").slice(0, 5),
      )

      if (siblingIds.countyId && suggestion.county.trim()) {
        nextData = writeFieldById(nextData, question, siblingIds.countyId, suggestion.county.trim())
      }
    }

    return {
      data: nextData,
      filledFieldIds: [siblingIds.streetId, siblingIds.cityId, siblingIds.stateId, siblingIds.zipId],
      validationError: null,
      validationNote: result.message || null,
    }
  } catch {
    return {
      data: nextData,
      filledFieldIds: [],
      validationError: "I couldn't validate that address right now. Please try again.",
      validationNote: null,
    }
  }
}

function getComplexQuestionPrefix(
  target: Pick<IntakeQuestion, "scope" | "sectionKey" | "personIndex">,
  parentFieldId: string,
): string {
  if (target.scope === "person") {
    return `complex:person:${target.personIndex ?? 0}:${target.sectionKey ?? ""}:${parentFieldId}`
  }

  return `complex:${target.scope}:${parentFieldId}`
}

function createRepeatableCountQuestion(
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

function createChecklistSelectionQuestion(
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

function createChecklistItemField(itemLabel: string, valueKey: string): SchemaField {
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

function collectChecklistQuestions(params: {
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

function collectQuestionsFromFields(params: {
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

function buildQuestions(data: WizardData): IntakeQuestion[] {
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

function parseAnswerValue(field: SchemaField, input: string): FieldValue {
  const raw = input.trim()
  const normalized = raw.toLowerCase()
  const isNoValueResponse =
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "skip" ||
    normalized === "no email"

  switch (field.type) {
    case "checkbox": {
      const parsed = normalizeYesNo(raw)
      if (parsed === null) {
        return null
      }

      if (field.id === "p1_no_home_address") {
        // UX asks positive form ("Do you have a home address?"), while schema stores inverse.
        return !parsed
      }

      return parsed
    }
    case "checkbox_group":
      return parseCheckboxGroupValues(raw, field.options)
    case "radio":
    case "select":
      return normalizeOptionValue(raw, field.options)
    case "phone":
      if (isNoValueResponse) {
        return ""
      }
      return formatPhoneNumber(raw)
    case "ssn":
      if (isNoValueResponse) {
        return ""
      }
      return formatSsn(raw)
    case "currency":
      if (isNoValueResponse) {
        return ""
      }
      return formatCurrency(raw)
    case "date":
      if (isNoValueResponse) {
        return ""
      }
      return normalizeFlexibleDateInput(raw) ?? raw
    case "zip":
      if (isNoValueResponse) {
        return ""
      }
      return raw.replace(/\D/g, "").slice(0, 5)
    case "number":
      if (isNoValueResponse) {
        return ""
      }
      return normalizeNumberInput(raw)
    default: {
      if (isNoValueResponse) {
        return ""
      }
      // Resolve numeric shorthand for fields with a hardcoded numbered prompt.
      if (field.id === "ethnicity" && /^\d+$/.test(raw)) {
        const ETHNICITY_OPTIONS = ["Hispanic or Latino", "Not Hispanic or Latino", "Choose not to answer"]
        const idx = Number.parseInt(raw, 10) - 1
        if (idx >= 0 && idx < ETHNICITY_OPTIONS.length) return ETHNICITY_OPTIONS[idx]
      }
      return raw
    }
  }
}

function isDeclineAnswer(input: string): boolean {
  const normalized = input.trim().toLowerCase()
  return (
    normalized === "no" ||
    normalized === "not" ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "skip" ||
    normalized === "nope"
  )
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getFirstNameFromWizardData(data: WizardData): string {
  const rawName = String(data.contact.p1_name ?? "").trim()
  if (!rawName) {
    return ""
  }

  const cleaned = rawName
    .replace(/\s+/g, " ")
    .replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, "")
    .trim()
  if (!cleaned) {
    return ""
  }

  return cleaned.split(" ")[0] ?? ""
}

function buildAcknowledgementPrefix(basePrefix: string, data: WizardData): string {
  const firstName = getFirstNameFromWizardData(data)
  if (!firstName) {
    return `${basePrefix}.`
  }

  return `${basePrefix}, ${firstName}.`
}

function applyInitialMemoExtraction(data: WizardData, memo: string): WizardData {
  const text = memo.trim()
  if (!text) {
    return data
  }

  const nextContact: FormRecord = { ...data.contact }
  const lower = text.toLowerCase()

  const nameMatch = text.match(
    /\b(?:my name is|i am|i'm)\s+([a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){1,3})\b/i,
  )
  if (nameMatch?.[1] && String(nextContact.p1_name ?? "").trim().length === 0) {
    nextContact.p1_name = toTitleCase(nameMatch[1])
  }

  const dateCandidate = extractLikelyDateFromText(text)
  const normalizedDob = dateCandidate ? normalizeFlexibleDateInput(dateCandidate) : null
  if (normalizedDob && String(nextContact.p1_dob ?? "").trim().length === 0) {
    nextContact.p1_dob = normalizedDob
  }

  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  if (emailMatch?.[0] && String(nextContact.p1_email ?? "").trim().length === 0) {
    nextContact.p1_email = emailMatch[0]
  }

  const phoneMatch = text.match(/(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}\b/)
  if (phoneMatch?.[0] && String(nextContact.p1_phone ?? "").trim().length === 0) {
    nextContact.p1_phone = formatPhoneNumber(phoneMatch[0])
  }

  const fullAddressMatch = text.match(
    /(\d{1,6}\s+[^,\n]+),\s*([^,\n]+),\s*([A-Za-z]{2})\s*(\d{5})?/,
  )
  if (fullAddressMatch) {
    if (String(nextContact.p1_home_street ?? "").trim().length === 0) {
      nextContact.p1_home_street = fullAddressMatch[1].trim()
    }
    if (String(nextContact.p1_home_city ?? "").trim().length === 0) {
      nextContact.p1_home_city = toTitleCase(fullAddressMatch[2])
    }
    if (String(nextContact.p1_home_state ?? "").trim().length === 0) {
      nextContact.p1_home_state = fullAddressMatch[3].toUpperCase()
    }
    if (fullAddressMatch[4] && String(nextContact.p1_home_zip ?? "").trim().length === 0) {
      nextContact.p1_home_zip = fullAddressMatch[4]
    }
    nextContact.p1_no_home_address = false
  }

  if (
    lower.includes("no home address") ||
    lower.includes("i am homeless") ||
    lower.includes("don't have a home address") ||
    lower.includes("do not have a home address")
  ) {
    nextContact.p1_no_home_address = true
  }

  const explicitCountMatch = lower.match(/\b(\d+)\s+(?:people|persons|household members|family members)\b/)
  if (explicitCountMatch?.[1]) {
    const count = clampPersonCount(explicitCountMatch[1])
    nextContact.p1_num_people = String(count)
  } else {
    const householdMentions = countHouseholdRelationshipMentions(lower)
    if (householdMentions > 0) {
      nextContact.p1_num_people = String(clampPersonCount(householdMentions + 1))
    }
  }

  let nextData: WizardData = {
    ...data,
    contact: nextContact,
  }

  const targetCount = clampPersonCount(nextData.contact.p1_num_people || nextData.persons.length || 1)
  nextData = ensurePersonCount(nextData, targetCount)

  // Mirror contact name/dob into person 0 identity to keep them in sync.
  if (nextData.persons[0] && nextContact.p1_name) {
    nextData = {
      ...nextData,
      persons: nextData.persons.map((p, i) =>
        i === 0 ? { ...p, identity: { ...p.identity, name: nextContact.p1_name } } : p,
      ),
    }
  }
  if (nextData.persons[0] && nextContact.p1_dob) {
    nextData = {
      ...nextData,
      persons: nextData.persons.map((p, i) =>
        i === 0 ? { ...p, identity: { ...p.identity, dob: nextContact.p1_dob } } : p,
      ),
    }
  }

  return nextData
}

function buildContextValuesForQuestion(data: WizardData, question: IntakeQuestion): Record<string, unknown> {
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

function computeAnsweredQuestionIds(questions: IntakeQuestion[], data: WizardData): Set<string> {
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

function shouldSkipQuestionInChat(question: IntakeQuestion, data: WizardData): boolean {
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

function findNextPendingQuestion(
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

/**
 * On resume, any unanswered optional question that precedes the last answered
 * question was clearly seen and skipped in a prior session.  Mark it skipped so
 * the user doesn't get sent back to it.  This handles legacy sessions that were
 * saved before chatSkippedIds persistence was added.
 */
function deriveSkippedFromLastAnswered(
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

export const createInitialIntakeData = createInitialData
export const buildIntakeQuestions = buildQuestions
export const computeAnsweredIntakeQuestionIds = computeAnsweredQuestionIds
export const findNextPendingIntakeQuestion = findNextPendingQuestion
export const parseIntakeAnswerValue = parseAnswerValue
export const writeIntakeQuestionValue = writeValue

function formatDisplayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return ""
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) {
    const items = (value as unknown[])
      .filter((v) => v !== undefined && v !== null && v !== "")
      .map(String)
    return items.join(", ")
  }
  if (typeof value === "object") return ""
  return String(value).trim()
}

function restoreWizardDataFromRaw(raw: unknown): WizardData | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const data = obj.data
  if (!data || typeof data !== "object") return null
  const d = data as Partial<WizardData>
  if (!d.contact) return null
  const initial = createInitialData()
  const contact = { ...initial.contact, ...(d.contact ?? {}) }
  const restoredPersons = Array.isArray(d.persons)
    ? d.persons.map((p, i) => {
        const base = makeDefaultPersonState(i)
        const sp = (p ?? {}) as Partial<PersonState>
        return {
          ...base, ...sp,
          identity: { ...base.identity, ...(sp.identity ?? {}) },
          demographics: { ...base.demographics, ...(sp.demographics ?? {}) },
          ssn: { ...base.ssn, ...(sp.ssn ?? {}) },
          tax: { ...base.tax, ...(sp.tax ?? {}) },
          coverage: { ...base.coverage, ...(sp.coverage ?? {}) },
          income: { ...base.income, ...(sp.income ?? {}) },
          skippedOptional: { ...base.skippedOptional, ...(sp.skippedOptional ?? {}) },
        }
      })
    : initial.persons

  // Ensure person 0 identity mirrors contact name/dob from existing saved data.
  if (restoredPersons[0] && contact.p1_name && !restoredPersons[0].identity.name) {
    restoredPersons[0] = { ...restoredPersons[0], identity: { ...restoredPersons[0].identity, name: contact.p1_name } }
  }
  if (restoredPersons[0] && contact.p1_dob && !restoredPersons[0].identity.dob) {
    restoredPersons[0] = { ...restoredPersons[0], identity: { ...restoredPersons[0].identity, dob: contact.p1_dob } }
  }

  const restored: WizardData = {
    ...initial,
    ...d,
    preApp: { ...initial.preApp, ...(d.preApp ?? {}) },
    contact,
    assister: { ...initial.assister, ...(d.assister ?? {}) },
    persons: restoredPersons,
    attestation: Boolean(d.attestation),
    assisterEnabled: Boolean(d.assisterEnabled),
  }
  return restored
}

export function IntakeChat({ applicationId, actingForPatientId, onSwitchToWizard, onSaveAndExit }: IntakeChatProps) {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const activeApplicationId = useAppSelector((state) => state.application.activeApplicationId)
  const resolvedApplicationId = applicationId ?? (activeApplicationId !== DEFAULT_APPLICATION_ID ? activeApplicationId ?? undefined : undefined)
  const selectedApplicationType = useAppSelector((state) => {
    if (!resolvedApplicationId) {
      return ""
    }

    return state.application.applicationsById[resolvedApplicationId]?.newApplicationForm.applicationType ?? ""
  })

  const savedAca3Wizard = useAppSelector((state) => {
    if (!resolvedApplicationId) return null
    return state.application.applicationsById[resolvedApplicationId]?.aca3Wizard ?? null
  })

  const copy = UI_COPY[selectedLanguage]

  const handleLanguageChange = (value: string) => {
    if (isSupportedLanguage(value)) {
      dispatch(setLanguage(value))
    }
  }

  const [wizardData, setWizardData] = useState<WizardData>(() => createInitialData())
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(() => new Set())
  const [skippedQuestionIds, setSkippedQuestionIds] = useState<Set<string>>(() => new Set())
  const [intakeStarted, setIntakeStarted] = useState(false)
  const [hydrationPending, setHydrationPending] = useState(true)
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<IntakeMessage[]>([])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null)
  const translationCacheRef = useRef<Map<string, string>>(new Map())
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const draftSaveBackoffUntilRef = useRef(0)
  const hydratedRef = useRef(false)

  // Restore previous session data from Redux cache or server draft on mount.
  useEffect(() => {
    if (hydratedRef.current) {
      setHydrationPending(false)
      return
    }

    const applyRestoredData = (raw: unknown) => {
      const restored = restoreWizardDataFromRaw(raw)
      if (!restored) return false
      const restoredQuestions = buildQuestions(restored)
      const restoredAnswered = computeAnsweredQuestionIds(restoredQuestions, restored)
      if (restoredAnswered.size === 0) return false

      // Restore explicitly persisted skipped IDs (new sessions).
      const rawObj = raw as Record<string, unknown>
      const persistedSkipped = new Set<string>()
      if (Array.isArray(rawObj.chatSkippedIds)) {
        for (const id of rawObj.chatSkippedIds) {
          if (typeof id === "string") persistedSkipped.add(id)
        }
      }

      // Derive skipped IDs from the last-answered checkpoint (covers legacy sessions
      // saved before chatSkippedIds was persisted, and acts as a safety net for new ones).
      const restoredSkipped = deriveSkippedFromLastAnswered(
        restoredQuestions, restoredAnswered, restored, persistedSkipped,
      )

      setWizardData(restored)
      setAnsweredQuestionIds(restoredAnswered)
      setSkippedQuestionIds(restoredSkipped)
      setIntakeStarted(true)
      const nextQ = findNextPendingQuestion(restoredQuestions, restoredAnswered, restored, restoredSkipped)
      setCurrentQuestionId(nextQ?.id ?? null)
      return true
    }

    // Try Redux cache first (fast, synchronous).
    if (savedAca3Wizard && applyRestoredData(savedAca3Wizard)) {
      hydratedRef.current = true
      setHydrationPending(false)
      return
    }

    // Fall back to server draft.
    if (!resolvedApplicationId) {
      setHydrationPending(false)
      return
    }
    let cancelled = false
    const loadFromServer = async () => {
      try {
        const headers = actingForPatientId
          ? { "X-Acting-For-Patient": actingForPatientId }
          : undefined
        const response = await authenticatedFetch(
          `/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`,
          { method: "GET", cache: "no-store", ...(headers ? { headers } : {}) },
        )
        if (!response.ok || cancelled) {
          if (!cancelled) setHydrationPending(false)
          return
        }
        const payload = (await response.json()) as { draftState?: unknown }
        if (!cancelled) {
          if (applyRestoredData(payload.draftState)) {
            hydratedRef.current = true
          }
          setHydrationPending(false)
        }
      } catch {
        // Draft load is best-effort; fresh session is fine.
        if (!cancelled) setHydrationPending(false)
      }
    }
    void loadFromServer()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actingForPatientId, resolvedApplicationId])

  const applicationTypeLabel = useMemo(() => {
    return (
      MASSHEALTH_APPLICATION_TYPES.find((option) => option.id === selectedApplicationType)?.shortLabel ??
      ""
    )
  }, [selectedApplicationType])

  const questions = useMemo(() => buildQuestions(wizardData), [wizardData])

  const collectedSections = useMemo(() => {
    const sectionMap = new Map<string, { title: string; items: { label: string; value: string; questionId: string }[] }>()
    // Track label+value pairs already shown to prevent cross-section duplicates.
    const globalDedupeSet = new Set<string>()

    for (const question of questions) {
      if (!answeredQuestionIds.has(question.id)) continue
      const value = readValue(wizardData, question)
      const displayValue = formatDisplayValue(value)
      if (!displayValue) continue

      const dedupeKey = `${question.field.label.trim().toLowerCase()}::${displayValue}`
      if (globalDedupeSet.has(dedupeKey)) continue
      globalDedupeSet.add(dedupeKey)

      const sectionKey =
        question.scope === "person" ? `person:${question.personIndex ?? 0}` : question.scope

      let section = sectionMap.get(sectionKey)
      if (!section) {
        let title: string
        if (question.scope === "person") {
          title = `Person ${(question.personIndex ?? 0) + 1}`
        } else if (question.scope === "contact") {
          title = "Personal Info"
        } else if (question.scope === "preApp") {
          title = "Pre-Application"
        } else if (question.scope === "assister") {
          title = "Assister Info"
        } else {
          title = question.scope
        }
        section = { title, items: [] }
        sectionMap.set(sectionKey, section)
      }

      section.items.push({ label: question.field.label, value: displayValue, questionId: question.id })
    }

    return Array.from(sectionMap.values()).filter((s) => s.items.length > 0)
  }, [questions, answeredQuestionIds, wizardData])

  const currentQuestion = useMemo(() => {
    if (!currentQuestionId) {
      return null
    }

    return questions.find((question) => question.id === currentQuestionId) ?? null
  }, [currentQuestionId, questions])

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return
      }

      const utterance = new SpeechSynthesisUtterance(toSpeakableQuestionText(text))
      const targetLang = resolveSpeechLanguage(selectedLanguage)
      utterance.lang = targetLang

      const voices = window.speechSynthesis.getVoices()
      const matchedVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(targetLang.toLowerCase()))
      if (matchedVoice) {
        utterance.voice = matchedVoice
      }

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    },
    [selectedLanguage],
  )

  const localizeQuestion = useCallback(
    async (text: string): Promise<string> => {
      if (selectedLanguage === "en") {
        return text
      }

      const cacheKey = `${selectedLanguage}:${text}`
      const cached = translationCacheRef.current.get(cacheKey)
      if (cached) {
        return cached
      }

      const languageLabel = SUPPORTED_LANGUAGES.find((language) => language.code === selectedLanguage)?.label ?? selectedLanguage

      try {
        const response = await authenticatedFetch("/api/chat/masshealth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "application_intake",
            messages: [
              {
                role: "user",
                content: `Translate exactly this intake question to ${languageLabel}. Return translation only. Keep option values unchanged: ${text}`,
              },
            ],
            language: selectedLanguage,
          }),
        })

        const payload = (await response.json()) as ChatApiResponse
        const translated = payload.reply?.trim()

        if (translated) {
          translationCacheRef.current.set(cacheKey, translated)
          return translated
        }
      } catch {
        // Fallback to source text if translation fails.
      }

      return text
    },
    [selectedLanguage],
  )

  const persistWizardData = useCallback(
    async (
      data: WizardData,
      opts?: { skippedIds?: Set<string>; answeredCount?: number; totalCount?: number },
    ) => {
      if (!resolvedApplicationId) {
        return
      }
      if (Date.now() < draftSaveBackoffUntilRef.current) {
        return
      }

      // Map answered/total to wizard step 1-9 so the dashboard progress bar reflects
      // actual chat completion rather than always showing step 1.
      const chatStep =
        opts?.answeredCount !== undefined && opts.totalCount && opts.totalCount > 0
          ? Math.max(1, Math.min(9, Math.round((opts.answeredCount / opts.totalCount) * 9)))
          : 1

      const wizardState = {
        ...createDraftWizardState(data, chatStep),
        chatSkippedIds: opts?.skippedIds ? [...opts.skippedIds] : [],
      }
      dispatch(
        setApplicationWizardState({
          applicationId: resolvedApplicationId,
          wizardState: wizardState as unknown as Record<string, unknown>,
        }),
      )

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        }
        if (actingForPatientId) {
          headers["X-Acting-For-Patient"] = actingForPatientId
        }

        const response = await authenticatedFetch(`/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            applicationType: selectedApplicationType || undefined,
            wizardState,
          }),
        })

        if (!response.ok && (response.status >= 500 || response.status === 429)) {
          draftSaveBackoffUntilRef.current = Date.now() + 15_000
          return
        }

        if (response.ok) {
          draftSaveBackoffUntilRef.current = 0
        }
      } catch {
        draftSaveBackoffUntilRef.current = Date.now() + 15_000
        // Non-blocking: local redux state remains up to date.
      }
    },
    [actingForPatientId, dispatch, resolvedApplicationId, selectedApplicationType],
  )

  const appendAssistantQuestion = useCallback(
    async (prefix: string, question: IntakeQuestion | null) => {
      if (!question) {
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: prefix,
          },
        ])
        return
      }

      const baseQuestion = formatQuestionPrompt(question)
      const localizedQuestion = await localizeQuestion(baseQuestion)
      const content = prefix ? `${prefix} ${localizedQuestion}` : localizedQuestion

      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content,
        },
      ])
      setCurrentQuestionId(question.id)
    },
    [localizeQuestion],
  )

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    const initialize = async () => {
      // Wait until the hydration attempt (Redux cache or server fetch) has resolved.
      if (hydrationPending) return
      if (messages.length > 0) return

      // If we restored a previous session, jump straight to the next pending question.
      if (hydratedRef.current) {
        const restoredQuestions = buildQuestions(wizardData)
        const nextQ = findNextPendingQuestion(restoredQuestions, answeredQuestionIds, wizardData, skippedQuestionIds)
        await appendAssistantQuestion(`${copy.savedPrefix}, let's continue where we left off.`, nextQ)
        return
      }

      const intro = applicationTypeLabel
        ? `${copy.savedPrefix} ${applicationTypeLabel} selected. ${copy.subtitle}`
        : copy.subtitle

      setMessages([
        {
          id: createMessageId(),
          role: "assistant",
          content: intro,
        },
        {
          id: createMessageId(),
          role: "assistant",
          content: copy.openingMemoPrompt,
        },
      ])
    }

    void initialize()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationPending, applicationTypeLabel, copy.openingMemoPrompt, copy.savedPrefix, copy.subtitle, messages.length])

  useEffect(() => {
    if (!autoSpeak) {
      return
    }

    const latest = messages[messages.length - 1]
    if (!latest || latest.role !== "assistant" || latest.id === lastSpokenMessageIdRef.current) {
      return
    }

    const { question } = splitTrailingQuestion(latest.content)
    if (!question) {
      return
    }

    lastSpokenMessageIdRef.current = latest.id
    speakText(question)
  }, [autoSpeak, messages, speakText])

  const handleAnswer = useCallback(async (answer: string) => {
    setIsLoading(true)

    try {
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "user",
          content: answer,
        },
      ])

      if (!intakeStarted) {
        const extractedData = applyInitialMemoExtraction(wizardData, answer)
        const refreshedQuestions = buildQuestions(extractedData)
        const refreshedAnswered = computeAnsweredQuestionIds(refreshedQuestions, extractedData)
        const nextQuestion = findNextPendingQuestion(
          refreshedQuestions,
          refreshedAnswered,
          extractedData,
          skippedQuestionIds,
        )

        setWizardData(extractedData)
        setAnsweredQuestionIds(refreshedAnswered)
        setIntakeStarted(true)
        await persistWizardData(extractedData, {
          skippedIds: skippedQuestionIds,
          answeredCount: refreshedAnswered.size,
          totalCount: refreshedQuestions.length,
        })

        if (!nextQuestion) {
          setCurrentQuestionId(null)
          setMessages((previous) => [
            ...previous,
            {
              id: createMessageId(),
              role: "assistant",
              content: copy.complete,
            },
          ])
          return
        }

        await appendAssistantQuestion(buildAcknowledgementPrefix(copy.savedPrefix, extractedData), nextQuestion)
        return
      }

      if (!currentQuestion) {
        return
      }

      let nextData = writeValue(wizardData, currentQuestion, parseAnswerValue(currentQuestion.field, answer))
      const mergedContextValues = buildContextValuesForQuestion(nextData, currentQuestion)

      const parsedValue = readValue(nextData, currentQuestion) as FieldValue
      const validationError = validateParsedFieldValue(
        currentQuestion.field,
        parsedValue,
        mergedContextValues,
      )

      if (validationError) {
        const prompt = await localizeQuestion(formatQuestionPrompt(currentQuestion))
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: `${validationError} ${prompt}`,
          },
        ])
        return
      }

      if (currentQuestion.field.id === "p1_language_spoken") {
        const detectedLang = SPOKEN_LANGUAGE_TO_CODE[answer.trim().toLowerCase()]
        if (detectedLang) {
          dispatch(setLanguage(detectedLang))
        }
        // Mirror spoken language to written language so it isn't asked again.
        nextData = writeFieldById(nextData, currentQuestion, "p1_language_written", parsedValue)
      }

      // Sync contact name/dob into person 0 identity to avoid duplicate questions.
      if (currentQuestion.scope === "contact" && currentQuestion.field.id === "p1_name") {
        const identityQuestion: IntakeQuestion = {
          id: "person:0:identity:name",
          field: { id: "name", label: "name", type: "text" },
          scope: "person",
          sectionKey: "identity",
          personIndex: 0,
        }
        nextData = writeValue(nextData, identityQuestion, parsedValue)
      }
      if (currentQuestion.scope === "contact" && currentQuestion.field.id === "p1_dob") {
        const identityQuestion: IntakeQuestion = {
          id: "person:0:identity:dob",
          field: { id: "dob", label: "dob", type: "date" },
          scope: "person",
          sectionKey: "identity",
          personIndex: 0,
        }
        nextData = writeValue(nextData, identityQuestion, parsedValue)
      }

      const addressAutofill = await applyAddressAutofillFromAnswer(nextData, currentQuestion, answer)
      nextData = addressAutofill.data

      const validationErrorMessage = addressAutofill.validationError
      if (typeof validationErrorMessage === "string" && validationErrorMessage.length > 0) {
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: validationErrorMessage,
          },
        ])
        return
      }

      const validationNoteMessage = addressAutofill.validationNote
      if (typeof validationNoteMessage === "string" && validationNoteMessage.length > 0) {
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: validationNoteMessage,
          },
        ])
      }

      if (currentQuestion.scope === "contact" && currentQuestion.field.id === "p1_num_people") {
        const parsedCount = clampPersonCount(nextData.contact.p1_num_people)
        nextData = ensurePersonCount(nextData, parsedCount)
      }

      const refreshedQuestions = buildQuestions(nextData)
      const nextAnswered = computeAnsweredQuestionIds(refreshedQuestions, nextData)
      const nextSkipped = new Set(skippedQuestionIds)
      const isRequired = isRequiredInCurrentContext(currentQuestion.field, mergedContextValues)

      if (!isRequired && isDeclineAnswer(answer) && !isFilledValue(parsedValue)) {
        nextSkipped.add(currentQuestion.id)
      } else if (isFilledValue(parsedValue)) {
        nextSkipped.delete(currentQuestion.id)
      }

      setWizardData(nextData)
      setAnsweredQuestionIds(nextAnswered)
      setSkippedQuestionIds(nextSkipped)
      await persistWizardData(nextData, {
        skippedIds: nextSkipped,
        answeredCount: nextAnswered.size,
        totalCount: refreshedQuestions.length,
      })

      let nextQuestion = findNextPendingQuestion(refreshedQuestions, nextAnswered, nextData, nextSkipped)

      if (currentQuestion.field.id === "p1_no_home_address") {
        const noHomeAddress = nextData.contact.p1_no_home_address === true

        if (noHomeAddress) {
          const mailingStreetQuestion = refreshedQuestions.find(
            (question) =>
              question.scope === "contact" &&
              question.field.id === "p1_mail_street" &&
              !nextAnswered.has(question.id),
          )

          if (mailingStreetQuestion) {
            nextQuestion = mailingStreetQuestion
          }
        } else {
          const homeStreetQuestion = refreshedQuestions.find(
            (question) =>
              question.scope === "contact" &&
              question.field.id === "p1_home_street" &&
              !nextAnswered.has(question.id),
          )

          if (homeStreetQuestion) {
            nextQuestion = homeStreetQuestion
          }
        }
      }

      if (!nextQuestion) {
        setCurrentQuestionId(null)
        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: copy.complete,
          },
        ])
        return
      }

      await appendAssistantQuestion(buildAcknowledgementPrefix(copy.savedPrefix, nextData), nextQuestion)
    } catch (error) {
      console.error("Intake submit error:", error)
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "assistant",
          content: "Something went wrong processing your answer. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeStarted, currentQuestion, wizardData, skippedQuestionIds, copy, applicationTypeLabel, dispatch, persistWizardData, appendAssistantQuestion, localizeQuestion])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft.trim() || isLoading) return
    const answer = draft.trim()
    setDraft("")
    await handleAnswer(answer)
  }

  const handleWidgetAnswer = useCallback(async (value: string) => {
    if (!value.trim() || isLoading) return
    setDraft("")
    await handleAnswer(value)
  }, [isLoading, handleAnswer])

  const handleEditAnswer = useCallback(
    async (questionId: string) => {
      const question = questions.find((q) => q.id === questionId)
      if (!question) return
      setCurrentQuestionId(questionId)
      await appendAssistantQuestion("Let me re-ask:", question)
    },
    [appendAssistantQuestion, questions],
  )

  const handleResetChat = () => {
    const resetData = createInitialData()
    setWizardData(resetData)
    setAnsweredQuestionIds(new Set())
    setSkippedQuestionIds(new Set())
    setIntakeStarted(false)
    setCurrentQuestionId(null)
    setMessages([])
    setDraft("")
    translationCacheRef.current.clear()
  }

  const completionPercent = useMemo(() => {
    const total = questions.length
    if (total === 0) return 0
    return Math.round((answeredQuestionIds.size / total) * 100)
  }, [answeredQuestionIds.size, questions.length])

  const widgetSpec = useMemo((): WidgetSpec | null => {
    if (!currentQuestion || !intakeStarted) return null
    const { field } = currentQuestion
    if (field.type === "checkbox") return { kind: "yes_no" }
    if (field.type === "date") return { kind: "date" }
    if (field.type === "phone") return { kind: "phone" }
    if (field.type === "ssn") return { kind: "ssn" }
    if (field.type === "checkbox_group" && field.options?.length) {
      return { kind: "multi_select", options: field.options }
    }
    if ((field.type === "radio" || field.type === "select") && field.options?.length) {
      return { kind: "single_select", options: field.options }
    }
    if (field.id === "ethnicity") {
      return {
        kind: "single_select",
        options: ["Hispanic or Latino", "Not Hispanic or Latino", "Choose not to answer"],
      }
    }
    return null
  }, [currentQuestion, intakeStarted])

  return (
    <IntakeChatPanel
      copy={copy}
      onSaveAndExit={onSaveAndExit ?? (() => router.back())}
      onSwitchToWizard={onSwitchToWizard}
      autoSpeak={autoSpeak}
      onAutoSpeakChange={setAutoSpeak}
      selectedLanguage={selectedLanguage}
      onLanguageChange={handleLanguageChange}
      messages={messages}
      isLoading={isLoading}
      completionPercent={completionPercent}
      onSpeakQuestion={speakText}
      bottomAnchorRef={bottomAnchorRef}
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={handleSubmit}
      disableInput={isLoading || (intakeStarted && !currentQuestion)}
      disableSubmit={isLoading || !draft.trim() || (intakeStarted && !currentQuestion)}
      onResetChat={handleResetChat}
      collectedSections={collectedSections}
      onEditAnswer={handleEditAnswer}
      widgetSpec={widgetSpec}
      onWidgetAnswer={handleWidgetAnswer}
      widgetKey={currentQuestionId ?? undefined}
    />
  )
}
