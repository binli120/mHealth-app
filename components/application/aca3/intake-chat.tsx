/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
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
import { isSupportedLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { setApplicationWizardState } from "@/lib/redux/features/application-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import { formatCurrency, formatPhoneNumber, formatSsn, parseCurrency } from "@/lib/utils/input-format"
import { createUuid } from "@/lib/utils/random-id"
import { normalizeNumberInput, parseDate, validateDobBounds } from "@/lib/utils/aca3-form"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import { countHouseholdRelationshipMentions } from "@/lib/masshealth/household-relationships"
import { evaluateConditionalRule } from "@/hooks/use-conditional"
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
  onSwitchToWizard: () => void
}

interface IntakeQuestion {
  id: string
  field: SchemaField
  scope: "preApp" | "contact" | "assister" | "person"
  sectionKey?: PersonSectionKey
  personIndex?: number
}

const UNSUPPORTED_FIELD_TYPES = new Set<SchemaField["type"]>([
  "repeatable_group",
  "income_checklist",
  "deduction_checklist",
])

const OPTIONAL_FIELDS_TO_SKIP_IN_CHAT = new Set<string>([
  "p1_home_apt",
  "p1_home_county",
  "p1_mail_apt",
  "p1_mail_county",
  "sep_apt",
  "sep_county",
])

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
  ethnicity: "What is your ethnicity?",
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

function createDraftWizardState(data: WizardData): WizardState {
  return {
    data,
    currentStep: 1,
    completedSteps: [],
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

  const partial = options.find((option) => lower.includes(option.toLowerCase()))
  if (partial) {
    return partial
  }

  return source
}

function parseCheckboxGroupValues(input: string, options: string[] | undefined): string[] {
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

  if (field.type === "checkbox") {
    return `${personPrefix}${baseLabel} Please answer Yes or No?`
  }

  if (field.type === "checkbox_group") {
    const options = field.options?.length ? ` Options: ${field.options.join(", ")}.` : ""
    return `${personPrefix}${baseLabel}${options} You can choose multiple values separated by commas. What are your selections?`
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

function readValue(data: WizardData, question: IntakeQuestion): unknown {
  if (question.scope === "preApp") {
    return data.preApp[question.field.id]
  }

  if (question.scope === "contact") {
    return data.contact[question.field.id]
  }

  if (question.scope === "assister") {
    return data.assister[question.field.id]
  }

  if (question.scope === "person" && question.sectionKey !== undefined && question.personIndex !== undefined) {
    const person = data.persons[question.personIndex]
    if (!person) {
      return undefined
    }

    return person[question.sectionKey][question.field.id]
  }

  return undefined
}

function writeValue(data: WizardData, question: IntakeQuestion, value: FieldValue): WizardData {
  if (question.scope === "preApp") {
    return {
      ...data,
      preApp: {
        ...data.preApp,
        [question.field.id]: value,
      },
    }
  }

  if (question.scope === "contact") {
    return {
      ...data,
      contact: {
        ...data.contact,
        [question.field.id]: value,
      },
    }
  }

  if (question.scope === "assister") {
    return {
      ...data,
      assister: {
        ...data.assister,
        [question.field.id]: value,
      },
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
      [question.sectionKey]: {
        ...person[question.sectionKey],
        [question.field.id]: value,
      },
    }

    return {
      ...data,
      persons: nextPeople,
    }
  }

  return data
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

function collectQuestionsFromFields(params: {
  fields: SchemaField[]
  contextValues: Record<string, unknown>
  data: WizardData
  target: Pick<IntakeQuestion, "scope" | "sectionKey" | "personIndex">
  result: IntakeQuestion[]
}) {
  const { fields, contextValues, data, target, result } = params

  for (const field of fields) {
    const personNumber = target.scope === "person" ? Number(target.personIndex ?? 0) + 1 : 1

    if (field.applicable_from_person && personNumber < field.applicable_from_person) {
      continue
    }

    if (field.show_if && !evaluateConditionalRuleForQuestioning(field.show_if, contextValues)) {
      continue
    }

    if (field.type === "address_group" && field.fields) {
      collectQuestionsFromFields({
        fields: Object.values(field.fields),
        contextValues,
        data,
        target,
        result,
      })
      continue
    }

    if (!UNSUPPORTED_FIELD_TYPES.has(field.type)) {
      const question: IntakeQuestion = {
        id:
          target.scope === "person"
            ? `person:${target.personIndex ?? 0}:${target.sectionKey ?? ""}:${field.id}`
            : `${target.scope}:${field.id}`,
        field,
        scope: target.scope,
        sectionKey: target.sectionKey,
        personIndex: target.personIndex,
      }
      result.push(question)
    }

    const currentValue = (() => {
      const syntheticQuestion: IntakeQuestion = {
        id: "",
        field,
        scope: target.scope,
        sectionKey: target.sectionKey,
        personIndex: target.personIndex,
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
    default:
      if (isNoValueResponse) {
        return ""
      }
      return raw
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

export function IntakeChat({ applicationId, onSwitchToWizard }: IntakeChatProps) {
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const activeApplicationId = useAppSelector((state) => state.application.activeApplicationId)
  const resolvedApplicationId = applicationId ?? activeApplicationId ?? undefined
  const selectedApplicationType = useAppSelector((state) => {
    if (!resolvedApplicationId) {
      return ""
    }

    return state.application.applicationsById[resolvedApplicationId]?.newApplicationForm.applicationType ?? ""
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
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<IntakeMessage[]>([])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null)
  const translationCacheRef = useRef<Map<string, string>>(new Map())
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const draftSaveBackoffUntilRef = useRef(0)

  const applicationTypeLabel = useMemo(() => {
    return (
      MASSHEALTH_APPLICATION_TYPES.find((option) => option.id === selectedApplicationType)?.shortLabel ??
      ""
    )
  }, [selectedApplicationType])

  const questions = useMemo(() => buildQuestions(wizardData), [wizardData])

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
    async (data: WizardData) => {
      if (!resolvedApplicationId) {
        return
      }
      if (Date.now() < draftSaveBackoffUntilRef.current) {
        return
      }

      const wizardState = createDraftWizardState(data)
      dispatch(
        setApplicationWizardState({
          applicationId: resolvedApplicationId,
          wizardState: wizardState as unknown as Record<string, unknown>,
        }),
      )

      try {
        const response = await authenticatedFetch(`/api/applications/${encodeURIComponent(resolvedApplicationId)}/draft`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
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
    [dispatch, resolvedApplicationId, selectedApplicationType],
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
      if (messages.length > 0) {
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
  }, [applicationTypeLabel, copy.openingMemoPrompt, copy.savedPrefix, copy.subtitle, messages.length])

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.trim() || isLoading) {
      return
    }

    const answer = draft.trim()
    setDraft("")
    setIsLoading(true)

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
      await persistWizardData(extractedData)

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
        setIsLoading(false)
        return
      }

      await appendAssistantQuestion(buildAcknowledgementPrefix(copy.savedPrefix, extractedData), nextQuestion)
      setIsLoading(false)
      return
    }

    if (!currentQuestion) {
      setIsLoading(false)
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
      setIsLoading(false)
      return
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
      setIsLoading(false)
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
    await persistWizardData(nextData)

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
      setIsLoading(false)
      return
    }

    await appendAssistantQuestion(buildAcknowledgementPrefix(copy.savedPrefix, nextData), nextQuestion)
    setIsLoading(false)
  }

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

  return (
    <IntakeChatPanel
      copy={copy}
      onSwitchToWizard={onSwitchToWizard}
      autoSpeak={autoSpeak}
      onAutoSpeakChange={setAutoSpeak}
      selectedLanguage={selectedLanguage}
      onLanguageChange={handleLanguageChange}
      messages={messages}
      isLoading={isLoading}
      onSpeakQuestion={speakText}
      bottomAnchorRef={bottomAnchorRef}
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={handleSubmit}
      disableInput={isLoading || (intakeStarted && !currentQuestion)}
      disableSubmit={isLoading || !draft.trim() || (intakeStarted && !currentQuestion)}
      onResetChat={handleResetChat}
    />
  )
}
