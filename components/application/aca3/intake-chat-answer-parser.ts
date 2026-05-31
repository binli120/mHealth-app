/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Pure (no JSX, no hooks) answer-parsing and display helpers for the ACA-3
 * intake chat.  Extracted from intake-chat.tsx so these functions can be
 * unit-tested in isolation and reused without importing the full component.
 */

import {
  DOB_FIELD_PATTERN,
  EMAIL_PATTERN,
  SSN_PATTERN,
} from "@/lib/constant"
import { isSupportedLanguage, type SupportedLanguage } from "@/lib/i18n/languages"
import { normalizeNumberInput, parseDate, validateDobBounds } from "@/lib/utils/aca3-form"
import { formatCurrency, formatPhoneNumber, formatSsn, parseCurrency } from "@/lib/utils/input-format"
import { countHouseholdRelationshipMentions } from "@/lib/masshealth/household-relationships"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import type { UserProfile } from "@/lib/user-profile/types"
import {
  clampPersonCount,
  createInitialData,
  ensurePersonCount,
  makeDefaultPersonState,
} from "./wizard-reducer"
import type { IntakeQuestion } from "./intake-chat-types"
import type { FieldValue, FormRecord, PersonState, SchemaField, WizardData } from "./types"

// ── Two-digit year normalization ──────────────────────────────────────────────

export function normalizeTwoDigitYear(year: number): number {
  const now = new Date()
  const currentTwoDigitYear = now.getFullYear() % 100

  if (year <= currentTwoDigitYear + 1) {
    return 2000 + year
  }

  return 1900 + year
}

// ── Date string construction ──────────────────────────────────────────────────

export function toUsDateString(month: number, day: number, year: number): string | null {
  const normalizedYear = year < 100 ? normalizeTwoDigitYear(year) : year
  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  const yyyy = String(normalizedYear)
  const candidate = `${mm}/${dd}/${yyyy}`
  return parseDate(candidate) ? candidate : null
}

// ── Flexible date input parser ────────────────────────────────────────────────

export function normalizeFlexibleDateInput(input: string): string | null {
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

// ── Free-text date extractor ──────────────────────────────────────────────────

export function extractLikelyDateFromText(text: string): string | null {
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

// ── Yes/No normalizer ─────────────────────────────────────────────────────────

export function normalizeYesNo(input: string): boolean | null {
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

// ── Option value normalizer ───────────────────────────────────────────────────

const SUPPLEMENTAL_FIELD_OPTIONS: Record<string, { mode: "single" | "multi"; options: string[] }> = {
  immigration_status_type: {
    mode: "multi",
    options: [
      "Lawful Permanent Resident (Green Card holder)",
      "Refugee",
      "Asylee",
      "Temporary Protected Status (TPS)",
      "Cuban/Haitian Entrant",
      "Amerasian",
      "Battered spouse, child, or parent (VAWA)",
      "Other qualified noncitizen",
      "Undocumented / No qualifying status",
    ],
  },
  immigration_doc_type: {
    mode: "single",
    options: [
      "Permanent Resident Card (I-551)",
      "Employment Authorization Document (EAD)",
      "Refugee Travel Document",
      "Arrival/Departure Record (I-94)",
      "Other immigration document",
    ],
  },
}

export function getSupplementalOptionsForField(fieldId: string): string[] {
  return SUPPLEMENTAL_FIELD_OPTIONS[fieldId]?.options ?? []
}

export function getSupplementalOptionModeForField(fieldId: string): "single" | "multi" | null {
  return SUPPLEMENTAL_FIELD_OPTIONS[fieldId]?.mode ?? null
}

export function normalizeOptionValue(input: string, options: string[] | undefined): string {
  const source = input.trim()

  if (!options || options.length === 0) {
    return source
  }

  if (/^\d+$/.test(source)) {
    const idx = Number.parseInt(source, 10) - 1
    if (idx >= 0 && idx < options.length) {
      return options[idx]
    }
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

// ── Checkbox group parser ─────────────────────────────────────────────────────

export function parseCheckboxGroupValues(input: string, options: string[] | undefined): string[] {
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

// ── Question prompt formatter ─────────────────────────────────────────────────

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

export function formatQuestionPrompt(question: IntakeQuestion): string {
  const field = question.field
  const personPrefix = question.scope === "person" ? `Person ${Number(question.personIndex ?? 0) + 1}: ` : ""
  const baseLabel = FRIENDLY_QUESTION_OVERRIDES[field.id] ?? field.label
  const supplementalOptions = getSupplementalOptionsForField(field.id)
  const supplementalMode = getSupplementalOptionModeForField(field.id)

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

  const fieldOptions = field.options && field.options.length > 0 ? field.options : supplementalOptions
  if (fieldOptions.length > 0) {
    if (supplementalMode === "multi") {
      const numbered = fieldOptions.map((opt, i) => `${i + 1}. ${opt}`).join("\n")
      return `${personPrefix}${baseLabel}\n${numbered}\nChoose one or more. Enter number(s) separated by commas, or type your answer.`
    }

    return `${personPrefix}${baseLabel} Options: ${fieldOptions.join(", ")}. What is your answer?`
  }

  if (field.type === "date") {
    return `${personPrefix}${baseLabel} Use MM/DD/YYYY, or choose a date.`
  }

  if (baseLabel.endsWith("?")) {
    return `${personPrefix}${baseLabel}`
  }

  return `${personPrefix}${baseLabel}${field.hint ? ` (${field.hint})` : ""}`
}

// ── Speech language resolver ──────────────────────────────────────────────────

export function resolveSpeechLanguage(language: SupportedLanguage): string {
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

// ── Speakable text converter ──────────────────────────────────────────────────

export function toSpeakableQuestionText(text: string): string {
  return text
    .replace(/\(\s*MM\/DD\/YYYY\s*\)/gi, "")
    .replace(/\bMM\/DD\/YYYY\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\?/g, "?")
    .trim()
}

// ── Top-level answer value parser ─────────────────────────────────────────────

export function parseAnswerValue(field: SchemaField, input: string): FieldValue {
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
      if (isNoValueResponse || normalized === "none of these apply") {
        return []
      }
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
      const supplementalOptions = getSupplementalOptionsForField(field.id)
      const supplementalMode = getSupplementalOptionModeForField(field.id)
      if (supplementalOptions.length > 0) {
        if (supplementalMode === "multi") {
          return parseCheckboxGroupValues(raw, supplementalOptions).join(", ")
        }

        return normalizeOptionValue(raw, supplementalOptions)
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

// ── Decline answer detector ───────────────────────────────────────────────────

export function isDeclineAnswer(input: string): boolean {
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

// ── Title case helper ─────────────────────────────────────────────────────────

export function toTitleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

// ── Name extraction ───────────────────────────────────────────────────────────

export function getFirstNameFromWizardData(data: WizardData): string {
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

// ── Acknowledgement prefix builder ────────────────────────────────────────────

export function buildAcknowledgementPrefix(basePrefix: string, data: WizardData): string {
  const firstName = getFirstNameFromWizardData(data)
  if (!firstName) {
    return `${basePrefix}.`
  }

  return `${basePrefix}, ${firstName}.`
}

// ── Opening memo extractor ────────────────────────────────────────────────────

export function applyInitialMemoExtraction(data: WizardData, memo: string): WizardData {
  const text = memo.trim()
  if (!text) {
    return data
  }

  const nextContact: FormRecord = { ...data.contact }
  const lower = text.toLowerCase()

  const nameMatch = text.match(
    /\b(?:my name is|i am|i'm)\s+([a-z][a-z''-]*(?:\s+[a-z][a-z''-]*){1,3})\b/i,
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

// ── Display value formatter ───────────────────────────────────────────────────

export function formatDisplayValue(value: unknown): string {
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

// ── WizardData restoration from localStorage raw object ──────────────────────

export function restoreWizardDataFromRaw(raw: unknown): WizardData | null {
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

// ── Profile pre-fill helpers ──────────────────────────────────────────────────

export function buildProfileFilledLabels(profile: UserProfile): string[] {
  const labels: string[] = []
  if (profile.firstName || profile.lastName) labels.push("name")
  if (profile.dateOfBirth) labels.push("date of birth")
  if (profile.phone) labels.push("phone number")
  if (profile.addressLine1) labels.push("home address")
  if (profile.citizenshipStatus) labels.push("citizenship status")
  return labels
}

export function applyProfileToWizardData(data: WizardData, profile: UserProfile): WizardData {
  const nextContact: FormRecord = { ...data.contact }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ")
  if (fullName) nextContact.p1_name = fullName
  if (profile.dateOfBirth) nextContact.p1_dob = profile.dateOfBirth
  if (profile.phone) nextContact.p1_phone = profile.phone
  if (profile.addressLine1) nextContact.p1_home_street = profile.addressLine1
  if (profile.addressLine2) nextContact.p1_home_apt = profile.addressLine2
  if (profile.city) nextContact.p1_home_city = profile.city
  if (profile.state) nextContact.p1_home_state = profile.state
  if (profile.zip) nextContact.p1_home_zip = profile.zip

  // Sync name/dob into person 0 identity and citizenship into coverage
  const nextPersons = [...data.persons]
  const person0 = nextPersons[0] ?? {}
  const nextIdentity = { ...(person0.identity as Record<string, unknown> ?? {}) }
  if (fullName) nextIdentity.name = fullName
  if (profile.dateOfBirth) nextIdentity.dob = profile.dateOfBirth
  const nextCoverage = { ...(person0.coverage as Record<string, unknown> ?? {}) }
  if (profile.citizenshipStatus) {
    nextCoverage.us_citizen = profile.citizenshipStatus === "citizen" ? "Yes" : "No"
  }
  nextPersons[0] = { ...person0, identity: nextIdentity as PersonState["identity"], coverage: nextCoverage as PersonState["coverage"] }

  return { ...data, contact: nextContact, persons: nextPersons }
}
