/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { createUuid } from "@/lib/utils/random-id"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import {
  detectCurrentSection,
  type FormSection,
} from "@/lib/masshealth/form-sections"
import { containsSsnLikeContent } from "@/lib/agents/sensitive-input"
import {
  type ApplicationFormData,
  type HouseholdMember,
  type IncomeSource,
} from "@/lib/redux/features/application-slice"
import type { UserProfile } from "@/lib/user-profile/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"

// ── Local type aliases (mirrors from application-assistant.tsx) ───────────────

type MessageRole = "user" | "assistant"

interface BaseMessage {
  id: string
  role: MessageRole
  content: string
}

interface TextMessage extends BaseMessage {
  type: "text"
}

interface UploadPromptMessage extends BaseMessage {
  type: "upload_prompt"
  docTypes: Array<{ type: string; label: string; description: string }>
}

export type { TextMessage, UploadPromptMessage }
export type AssistantMessage = TextMessage | UploadPromptMessage

export interface ApiChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface QuickReply {
  label: string
  value: string
}

export interface AssistantDraftState {
  mode: "form_assistant"
  updatedAt: string
  formData: Partial<ApplicationFormData>
  messages: AssistantMessage[]
  noHouseholdMembers: boolean
  noIncome: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const SECTION_LABELS: Record<FormSection, string> = {
  personal: "Personal Info",
  contact: "Contact Details",
  household: "Household",
  income: "Income",
  documents: "Documents",
}

export const SECTION_ORDER: FormSection[] = ["personal", "contact", "household", "income", "documents"]

export const REQUIRED_DOCS = [
  {
    type: "driver_license",
    label: "Driver License",
    description: "Front and back photos of a driver's license",
  },
  {
    type: "passport",
    label: "Passport",
    description: "Passport photo page",
  },
  {
    type: "paystub",
    label: "Paystub",
    description: "Recent paystub for income verification",
  },
  {
    type: "proof_of_residency",
    label: "Proof of MA Residency",
    description: "Utility bill, bank statement, or lease agreement",
  },
]

export const ACTIVE_ASSISTANT_APPLICATION_KEY = "healthcompass.applicationAssistant.activeApplicationId"
export const ASSISTANT_DRAFT_STORAGE_PREFIX = "healthcompass.applicationAssistant.draft."

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "EN",
  "zh-CN": "中文",
  ht: "HT",
  "pt-BR": "PT",
  es: "ES",
  vi: "VI",
}

// BCP-47 tags for Web Speech API
export const SPEECH_LANG: Record<SupportedLanguage, string> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  ht: "fr-HT",
  "pt-BR": "pt-BR",
  es: "es-US",
  vi: "vi-VN",
}

export const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

export const ASSISTANT_CONNECTION_FAILURE_MESSAGE =
  "Compass is having trouble reaching the AI engine right now. Your answers are still in this session. You can try again after the service is back, or switch to the Form Wizard to continue without the AI assistant."

// ── Input field-type detection & auto-formatting ─────────────────────────────

export type InputFieldType = "phone" | "ssn" | "date" | "email" | "money" | "text"

export function detectInputFieldType(lastAssistantMsg: string): InputFieldType {
  const full = lastAssistantMsg.toLowerCase()
  // Use only the last clause (the actual question being asked). This prevents
  // confirmed context — e.g. "I have your date of birth as 01/15/1990" — from
  // misidentifying the field type when the follow-up question is different.
  const clauses = full.split(/(?<=[.!?])\s+/)
  const lastClause = clauses[clauses.length - 1]?.trim() ?? ""
  const msg = lastClause.length >= 15 ? lastClause : full
  if (/social.?security|ssn|\bss#/.test(msg)) return "ssn"
  if (/\bphone\b|telephone|cell|mobile|call you|phone number/.test(msg)) return "phone"
  if (/date of birth|when were you born|\bdob\b|birthday|born on/.test(msg)) return "date"
  if (/\bemail\b|e-mail/.test(msg)) return "email"
  if (/income|salary|wages?|earn|how much|amount|monthly|weekly|annually|per (month|week|year)/.test(msg)) return "money"
  return "text"
}

/** Format digits-only input as (xxx) xxx-xxxx */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

/** Format digits-only input as xxx-xx-xxxx */
export function formatSSN(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 9)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

/** Auto-insert slashes while user types a date with digits only */
export function formatDateDigits(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

export function formatCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${month}/${day}/${date.getFullYear()}`
}

export function parseCalendarDate(raw: string): Date | undefined {
  const formatted = parseNaturalDate(raw)
  const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return undefined

  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return date
}

/**
 * Parse natural-language or partial dates into MM/DD/YYYY.
 * Examples:
 *   "Jan 17, 80"    → "01/17/1980"
 *   "January 17 80" → "01/17/1980"
 *   "1/17/80"       → "01/17/1980"
 *   "01/17/1980"    → "01/17/1980" (unchanged)
 */
export function parseNaturalDate(raw: string): string {
  const v = raw.trim()

  // Already MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v

  const currentYear2d = new Date().getFullYear() % 100

  const expand2dYear = (y: number) =>
    y <= currentYear2d ? 2000 + y : 1900 + y

  const pad = (n: number) => String(n).padStart(2, "0")

  // Pattern: "MonthName DD, YY" or "MonthName DD YYYY"
  const namePattern = /^([a-z]+)\s+(\d{1,2})[,\s]+(\d{2,4})$/i
  const nameMatch = v.match(namePattern)
  if (nameMatch) {
    const month = MONTH_MAP[nameMatch[1].toLowerCase()]
    if (month) {
      const day = parseInt(nameMatch[2], 10)
      let year = parseInt(nameMatch[3], 10)
      if (year < 100) year = expand2dYear(year)
      return `${pad(month)}/${pad(day)}/${year}`
    }
  }

  // Pattern: M/D/YY or M/D/YYYY
  const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
  const slashMatch = v.match(slashPattern)
  if (slashMatch) {
    let year = parseInt(slashMatch[3], 10)
    if (year < 100) year = expand2dYear(year)
    return `${pad(parseInt(slashMatch[1], 10))}/${pad(parseInt(slashMatch[2], 10))}/${year}`
  }

  return v // return as-is if unparseable
}

/** Format a dollar amount string: "3000" → "$3,000" */
export function formatMoney(raw: string): string {
  const stripped = raw.replace(/[^0-9.]/g, "")
  if (!stripped) return raw
  const [whole, decimal] = stripped.split(".")
  const withCommas = (whole ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return decimal !== undefined ? `$${withCommas}.${decimal.slice(0, 2)}` : `$${withCommas}`
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function getAssistantDraftCacheKey(applicationId: string): string {
  return `${ASSISTANT_DRAFT_STORAGE_PREFIX}${applicationId}`
}

export function resolveInitialAssistantApplicationId(providedApplicationId?: string): string {
  if (providedApplicationId) return providedApplicationId
  if (typeof window === "undefined") return createUuid()

  const existing = window.localStorage.getItem(ACTIVE_ASSISTANT_APPLICATION_KEY)
  if (existing) return existing

  const next = createUuid()
  window.localStorage.setItem(ACTIVE_ASSISTANT_APPLICATION_KEY, next)
  return next
}

export function getQuickRepliesForAssistantPrompt(
  prompt: string,
  profileFillMode: "pending" | "confirming" | "accepted" | "declined",
): QuickReply[] {
  if (profileFillMode === "pending") {
    return [
      { label: "Yes, use my saved info", value: "Yes" },
      { label: "No, start fresh", value: "No" },
    ]
  }

  const normalized = prompt.toLowerCase()
  if (/use your saved info|saved info|start fresh/.test(normalized) && /\byes\b/.test(normalized) && /\bno\b/.test(normalized)) {
    return [
      { label: "Yes, use my saved info", value: "Yes" },
      { label: "No, start fresh", value: "No" },
    ]
  }

  const asksForConfirmation =
    /\b(reply|answer|select|choose)\b[\s\S]*\b(yes|no)\b/.test(normalized) ||
    /\b(yes|no)\b[\s\S]*\b(confirm|continue|start fresh|use your saved info)\b/.test(normalized) ||
    /\bdid you mean\b/.test(normalized)

  if (!asksForConfirmation) return []

  return [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ]
}

export function getNextMissingApplicationQuestion(
  formData: Partial<ApplicationFormData>,
  noHouseholdMembers = false,
  noIncome = false,
): string {
  if (!formData.firstName) return "Let's start with your name. What's your first name?"
  if (!formData.lastName) return "What is your last name?"
  if (!formData.dob) return "What is your date of birth?"
  if (!formData.email) return "What is your email address?"
  if (!formData.phone) return "What phone number should MassHealth use to contact you?"
  if (!formData.address) return "What is your home street address?"
  if (!formData.city) return "What city do you live in?"
  if (!formData.zip) return "What is your ZIP code?"
  if (!noHouseholdMembers && !formData.householdMembers?.length) {
    return "Does anyone else live in your household?"
  }
  if (!noIncome && !formData.incomeSources?.length) {
    return "Do you or anyone in your household have income from work, benefits, or another source?"
  }
  return "Your main application details are complete. Please upload any requested supporting documents when you're ready."
}

interface ImmediateFieldPatch {
  fields: Partial<ApplicationFormData>
  noHouseholdMembers?: boolean
  noIncome?: boolean
}

export function hasPatchValueChanged(
  formData: ApplicationFormData,
  patch: Partial<ApplicationFormData>,
): boolean {
  return Object.entries(patch).some(([key, value]) => {
    const fieldKey = key as keyof ApplicationFormData
    return JSON.stringify(formData[fieldKey]) !== JSON.stringify(value)
  })
}

export function getImmediateFieldPatchFromAnswer(
  answer: string,
  lastAssistantPrompt: string,
  formData: ApplicationFormData,
  currentSection: FormSection,
  inputFieldType: InputFieldType,
): ImmediateFieldPatch {
  const trimmed = answer.trim()
  if (!trimmed) return { fields: {} }

  const prompt = lastAssistantPrompt.toLowerCase()
  const normalizedAnswer = trimmed.toLowerCase()
  const fields: Partial<ApplicationFormData> = {}

  const parsedAddress = parsePastedUsAddress(trimmed)
  if (parsedAddress) {
    return {
      fields: {
        address: parsedAddress.streetAddress,
        city: parsedAddress.city,
        state: parsedAddress.state,
        zip: parsedAddress.zipCode,
      },
    }
  }

  if (
    currentSection === "household" &&
    !formData.householdMembers.length &&
    /\b(no|none|nobody|no one|live alone|alone)\b/.test(normalizedAnswer)
  ) {
    return { fields: {}, noHouseholdMembers: true }
  }

  if (
    currentSection === "income" &&
    !formData.incomeSources.length &&
    /\b(no|none|no income|unemployed|not working)\b/.test(normalizedAnswer)
  ) {
    return { fields: {}, noIncome: true }
  }

  // Explicit field-keyword checks take priority over input-type heuristics,
  // preventing "last name" answers from being misrouted to dob when the AI
  // message mentions "date of birth" alongside the actual question.
  if (/\bfirst name\b/.test(prompt) && !formData.firstName) {
    fields.firstName = trimmed
    return { fields }
  }

  if (/\blast name\b/.test(prompt) && !formData.lastName) {
    fields.lastName = trimmed
    return { fields }
  }

  if (inputFieldType === "email" || /\bemail\b|e-mail/.test(prompt)) {
    if (isValidEmail(trimmed)) fields.email = trimmed.toLowerCase()
    return { fields }
  }

  if (inputFieldType === "phone" || /\bphone\b|telephone|cell|mobile/.test(prompt)) {
    fields.phone = formatPhone(trimmed)
    return { fields }
  }

  if (inputFieldType === "date" || /date of birth|\bdob\b|birthday|born/.test(prompt)) {
    fields.dob = parseNaturalDate(trimmed)
    return { fields }
  }

  if (/\b(city|town)\b/.test(prompt) && !formData.city) {
    fields.city = trimmed
  } else if (/\b(zip|postal)\b/.test(prompt) && !formData.zip) {
    const zip = trimmed.match(/\d{5}/)?.[0]
    if (zip) fields.zip = zip
  } else if (/\b(street|home address|address)\b/.test(prompt) && !formData.address) {
    fields.address = trimmed
  } else if (currentSection === "personal") {
    if (!formData.firstName) fields.firstName = trimmed
    else if (!formData.lastName) fields.lastName = trimmed
    // dob is handled above via the date keyword/inputFieldType check
  } else if (currentSection === "contact") {
    if (!formData.email && isValidEmail(trimmed)) fields.email = trimmed.toLowerCase()
    else if (!formData.phone && /\d{10,}/.test(trimmed.replace(/\D/g, ""))) fields.phone = formatPhone(trimmed)
    else if (!formData.address) fields.address = trimmed
    else if (!formData.city) fields.city = trimmed
    else if (!formData.zip) {
      const zip = trimmed.match(/\d{5}/)?.[0]
      if (zip) fields.zip = zip
    }
  }

  return { fields }
}

export function recoverImmediateFieldsFromMessages(
  messages: AssistantMessage[],
  baseFormData: ApplicationFormData,
  noHouseholdMembers = false,
  noIncome = false,
): ImmediateFieldPatch {
  let workingData = { ...baseFormData }
  let householdComplete = noHouseholdMembers
  let incomeComplete = noIncome
  let lastAssistantPrompt = ""
  const recovered: Partial<ApplicationFormData> = {}

  for (const message of messages) {
    if (message.type !== "text") continue

    if (message.role === "assistant") {
      if (message.content !== ASSISTANT_CONNECTION_FAILURE_MESSAGE) {
        lastAssistantPrompt = message.content
      }
      continue
    }

    const section = detectCurrentSection(workingData, householdComplete, incomeComplete)
    const patch = getImmediateFieldPatchFromAnswer(
      message.content,
      lastAssistantPrompt,
      workingData,
      section,
      detectInputFieldType(lastAssistantPrompt),
    )

    if (Object.keys(patch.fields).length > 0) {
      recovered.applicationType = recovered.applicationType ?? patch.fields.applicationType
      recovered.firstName = recovered.firstName ?? patch.fields.firstName
      recovered.lastName = recovered.lastName ?? patch.fields.lastName
      recovered.dob = recovered.dob ?? patch.fields.dob
      recovered.email = recovered.email ?? patch.fields.email
      recovered.phone = recovered.phone ?? patch.fields.phone
      recovered.address = recovered.address ?? patch.fields.address
      recovered.city = recovered.city ?? patch.fields.city
      recovered.state = recovered.state ?? patch.fields.state
      recovered.zip = recovered.zip ?? patch.fields.zip
      workingData = { ...workingData, ...patch.fields }
    }
    if (patch.noHouseholdMembers) householdComplete = true
    if (patch.noIncome) incomeComplete = true
  }

  return {
    fields: Object.fromEntries(
      Object.entries(recovered).filter(([, value]) => value !== undefined && value !== ""),
    ) as Partial<ApplicationFormData>,
    noHouseholdMembers: householdComplete && !noHouseholdMembers,
    noIncome: incomeComplete && !noIncome,
  }
}

// ── Progress helpers ──────────────────────────────────────────────────────────

interface SectionField {
  label: string
  value: string
  key?: keyof ApplicationFormData
  editable?: boolean
}

export function getSectionFields(formData: ApplicationFormData, section: FormSection): SectionField[] {
  switch (section) {
    case "personal":
      return [
        { label: "First name", value: formData.firstName, key: "firstName", editable: true },
        { label: "Last name", value: formData.lastName, key: "lastName", editable: true },
        { label: "Date of birth", value: formData.dob, key: "dob", editable: true },
      ]
    case "contact":
      return [
        { label: "Email", value: formData.email, key: "email", editable: true },
        { label: "Phone", value: formData.phone, key: "phone", editable: true },
        { label: "Address", value: formData.address, key: "address", editable: true },
        { label: "City", value: formData.city, key: "city", editable: true },
        { label: "State", value: formData.state, key: "state", editable: true },
        { label: "ZIP", value: formData.zip, key: "zip", editable: true },
      ]
    case "household":
      return (formData.householdMembers?.length ?? 0) > 0
        ? formData.householdMembers.map((m) => ({
            label: `${m.firstName} ${m.lastName}`,
            value: m.relationship,
          }))
        : [{ label: "Members", value: "" }]
    case "income":
      return (formData.incomeSources?.length ?? 0) > 0
        ? formData.incomeSources.map((s) => ({
            label: s.type,
            value: `$${s.amount}/${s.frequency}`,
          }))
        : [{ label: "Sources", value: "" }]
    case "documents":
      return REQUIRED_DOCS.map((d) => ({ label: d.label, value: "" }))
  }
}

export function isSectionComplete(
  formData: ApplicationFormData,
  section: FormSection,
  noHousehold: boolean,
  noIncome: boolean,
): boolean {
  switch (section) {
    case "personal":
      return Boolean(formData.firstName && formData.lastName && formData.dob)
    case "contact":
      return Boolean(formData.email && formData.phone && formData.address && formData.city && formData.zip)
    case "household":
      return noHousehold || (formData.householdMembers?.length ?? 0) > 0
    case "income":
      return noIncome || (formData.incomeSources?.length ?? 0) > 0
    case "documents":
      return false // never "complete" — user uploads on their own time
  }
}

export function computeProgress(
  formData: ApplicationFormData,
  noHousehold: boolean,
  noIncome: boolean,
): number {
  const completed = SECTION_ORDER.filter((s) =>
    s !== "documents" && isSectionComplete(formData, s, noHousehold, noIncome)
  ).length
  return Math.round((completed / 4) * 100)
}

/** Maps a saved UserProfile into ApplicationFormData fields that can be pre-filled. */
export function buildPreFillFromProfile(profile: UserProfile): Partial<ApplicationFormData> {
  const fields: Partial<ApplicationFormData> = {}
  if (profile.firstName) fields.firstName = profile.firstName
  if (profile.lastName) fields.lastName = profile.lastName
  if (profile.dateOfBirth) fields.dob = profile.dateOfBirth
  if (profile.phone) fields.phone = profile.phone
  if (profile.addressLine1) fields.address = profile.addressLine1
  if (profile.addressLine2) fields.apartment = profile.addressLine2
  if (profile.city) fields.city = profile.city
  if (profile.state) fields.state = profile.state
  if (profile.zip) fields.zip = profile.zip
  if (profile.citizenshipStatus) fields.citizenship = profile.citizenshipStatus
  return fields
}

/** Returns a human-readable list of which profile fields were applied. */
export function describedAppliedFields(profile: UserProfile): string[] {
  const labels: string[] = []
  if (profile.firstName || profile.lastName) labels.push("name")
  if (profile.dateOfBirth) labels.push("date of birth")
  if (profile.phone) labels.push("phone number")
  if (profile.addressLine1) labels.push("home address")
  if (profile.citizenshipStatus) labels.push("citizenship status")
  return labels
}

export function hasDocumentUploadPrompt(messages: AssistantMessage[]): boolean {
  return messages.some((message) => message.type === "upload_prompt")
}

export function sanitizeAssistantDraftMessages(messages: AssistantMessage[]): AssistantMessage[] {
  const lastUploadPromptIndex = messages.findLastIndex((message) => message.type === "upload_prompt")

  return messages
    .filter((message, index) => {
      const content = message.content.trim()
      if (content.length === 0 || content === ASSISTANT_CONNECTION_FAILURE_MESSAGE) return false

      if (message.type === "upload_prompt") return index === lastUploadPromptIndex

      return true
    })
    .slice(-60)
}

export function createAssistantDraftState(
  formData: ApplicationFormData,
  messages: AssistantMessage[],
  noHouseholdMembers: boolean,
  noIncome: boolean,
): AssistantDraftState {
  return {
    mode: "form_assistant",
    updatedAt: new Date().toISOString(),
    formData: {
      ...formData,
      ssn: "",
      householdMembers: formData.householdMembers.map((member) => ({ ...member, ssn: "" })),
    },
    messages: sanitizeAssistantDraftMessages(messages),
    noHouseholdMembers,
    noIncome,
  }
}

export function readAssistantDraftState(raw: unknown): AssistantDraftState | null {
  if (!raw || typeof raw !== "object") return null
  const candidate = "formAssistant" in raw
    ? (raw as { formAssistant?: unknown }).formAssistant
    : raw
  if (!candidate || typeof candidate !== "object") return null
  const draft = candidate as Partial<AssistantDraftState>
  if (draft.mode !== "form_assistant" || !draft.formData || typeof draft.formData !== "object") return null

  return {
    mode: "form_assistant",
    updatedAt: typeof draft.updatedAt === "string" ? draft.updatedAt : "",
    formData: draft.formData,
    messages: sanitizeAssistantDraftMessages(Array.isArray(draft.messages) ? draft.messages.filter((message): message is AssistantMessage => {
      return Boolean(
        message &&
        typeof message === "object" &&
        "type" in message &&
        "role" in message &&
        "content" in message &&
        typeof (message as { content?: unknown }).content === "string",
      )
    }) : []),
    noHouseholdMembers: draft.noHouseholdMembers === true,
    noIncome: draft.noIncome === true,
  }
}

export function hasMeaningfulDraftValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === "object") return Object.keys(value).length > 0
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "boolean") return value
  return false
}

export function hasPersistableAssistantDraft(
  fields: Partial<ApplicationFormData>,
  messages: AssistantMessage[],
  noHouseholdMembers: boolean,
  noIncome: boolean,
): boolean {
  return (
    Object.values(fields).some(hasMeaningfulDraftValue) ||
    messages.some((message) => message.role === "user") ||
    messages.some((message) => message.type === "upload_prompt") ||
    noHouseholdMembers ||
    noIncome
  )
}
