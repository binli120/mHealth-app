/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Mic, MicOff, Send, CheckCircle2, Circle, ChevronDown, ChevronUp, ArrowRight, Loader2, User, UserRound, Volume2, VolumeX, CalendarDays, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  createApplication,
  initialApplicationFormData,
  setActiveApplication,
  patchNewApplicationForm,

  type ApplicationFormData,
  type HouseholdMember,
  type IncomeSource,
} from "@/lib/redux/features/application-slice"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { readChatStream } from "@/lib/chat/read-stream"
import { isSupportedLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis"
import { createUuid } from "@/lib/utils/random-id"
import {
  getFormAssistantGreeting,
  getProfileAwareFormAssistantGreeting,
  getProfilePreFillConfirmation,
  getProfilePreFillDeclineResponse,
  type ProfilePreFillSummary,
} from "@/lib/masshealth/chat-knowledge"
import type { UserProfile } from "@/lib/user-profile/types"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import {
  summarizeCollectedFields,
  detectCurrentSection,
  type FormSection,
} from "@/lib/masshealth/form-sections"
import { DocumentUploader } from "@/components/application/document-uploader"
import { containsSsnLikeContent, SSN_CHAT_HANDOFF_MESSAGE } from "@/lib/agents/sensitive-input"

// ── Types ─────────────────────────────────────────────────────────────────────

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

type AssistantMessage = TextMessage | UploadPromptMessage

interface ApiChatMessage {
  role: "user" | "assistant"
  content: string
}

interface QuickReply {
  label: string
  value: string
}

interface AssistantDraftState {
  mode: "form_assistant"
  updatedAt: string
  formData: Partial<ApplicationFormData>
  messages: AssistantMessage[]
  noHouseholdMembers: boolean
  noIncome: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<FormSection, string> = {
  personal: "Personal Info",
  contact: "Contact Details",
  household: "Household",
  income: "Income",
  documents: "Documents",
}

const SECTION_ORDER: FormSection[] = ["personal", "contact", "household", "income", "documents"]

const REQUIRED_DOCS = [
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

const ACTIVE_ASSISTANT_APPLICATION_KEY = "healthcompass.applicationAssistant.activeApplicationId"
const ASSISTANT_DRAFT_STORAGE_PREFIX = "healthcompass.applicationAssistant.draft."

function getAssistantDraftCacheKey(applicationId: string): string {
  return `${ASSISTANT_DRAFT_STORAGE_PREFIX}${applicationId}`
}

function resolveInitialAssistantApplicationId(providedApplicationId?: string): string {
  if (providedApplicationId) return providedApplicationId
  if (typeof window === "undefined") return createUuid()

  const existing = window.localStorage.getItem(ACTIVE_ASSISTANT_APPLICATION_KEY)
  if (existing) return existing

  const next = createUuid()
  window.localStorage.setItem(ACTIVE_ASSISTANT_APPLICATION_KEY, next)
  return next
}

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "EN",
  "zh-CN": "中文",
  ht: "HT",
  "pt-BR": "PT",
  es: "ES",
  vi: "VI",
}

// BCP-47 tags for Web Speech API
const SPEECH_LANG: Record<SupportedLanguage, string> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  ht: "fr-HT",
  "pt-BR": "pt-BR",
  es: "es-US",
  vi: "vi-VN",
}

// ── Input field-type detection & auto-formatting ─────────────────────────────

type InputFieldType = "phone" | "ssn" | "date" | "email" | "money" | "text"

function detectInputFieldType(lastAssistantMsg: string): InputFieldType {
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
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

/** Format digits-only input as xxx-xx-xxxx */
function formatSSN(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 9)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

/** Auto-insert slashes while user types a date with digits only */
function formatDateDigits(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

function formatCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${month}/${day}/${date.getFullYear()}`
}

function parseCalendarDate(raw: string): Date | undefined {
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

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

/**
 * Parse natural-language or partial dates into MM/DD/YYYY.
 * Examples:
 *   "Jan 17, 80"    → "01/17/1980"
 *   "January 17 80" → "01/17/1980"
 *   "1/17/80"       → "01/17/1980"
 *   "01/17/1980"    → "01/17/1980" (unchanged)
 */
function parseNaturalDate(raw: string): string {
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
function formatMoney(raw: string): string {
  const stripped = raw.replace(/[^0-9.]/g, "")
  if (!stripped) return raw
  const [whole, decimal] = stripped.split(".")
  const withCommas = (whole ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return decimal !== undefined ? `$${withCommas}.${decimal.slice(0, 2)}` : `$${withCommas}`
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

const FIELD_TYPE_HINT: Record<InputFieldType, string> = {
  phone: "Format: (xxx) xxx-xxxx",
  ssn: "Format: xxx-xx-xxxx",
  date: 'Format: MM/DD/YYYY — or type like "Jan 17, 80"',
  email: "Enter a valid email address",
  money: "Enter amount, e.g. 3,000 or 3000.50",
  text: "",
}

export const ASSISTANT_CONNECTION_FAILURE_MESSAGE =
  "Compass is having trouble reaching the AI engine right now. Your answers are still in this session. You can try again after the service is back, or switch to the Form Wizard to continue without the AI assistant."

function CompassIcon({ className }: { className?: string }) {
  return <UserRound className={className} aria-hidden="true" />
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

function hasPatchValueChanged(
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

function getSectionFields(formData: ApplicationFormData, section: FormSection): SectionField[] {
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

function isSectionComplete(
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

function computeProgress(
  formData: ApplicationFormData,
  noHousehold: boolean,
  noIncome: boolean,
): number {
  const completed = SECTION_ORDER.filter((s) =>
    s !== "documents" && isSectionComplete(formData, s, noHousehold, noIncome)
  ).length
  return Math.round((completed / 4) * 100)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ApplicationAssistantProps {
  applicationId?: string
  actingForPatientId?: string
  /** Structured form data pre-parsed from an uploaded document. When provided
   *  these fields are applied directly to the Redux store and the assistant
   *  skips to asking only about missing or uncertain fields. */
  prefillFormData?: Partial<ApplicationFormData>
  onSwitchToWizard?: () => void
}

/** Maps a saved UserProfile into ApplicationFormData fields that can be pre-filled. */
function buildPreFillFromProfile(profile: UserProfile): Partial<ApplicationFormData> {
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
  return fields
}

/** Returns a human-readable list of which profile fields were applied. */
function describedAppliedFields(profile: UserProfile): string[] {
  const labels: string[] = []
  if (profile.firstName || profile.lastName) labels.push("name")
  if (profile.dateOfBirth) labels.push("date of birth")
  if (profile.phone) labels.push("phone number")
  if (profile.addressLine1) labels.push("home address")
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

function createAssistantDraftState(
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

function readAssistantDraftState(raw: unknown): AssistantDraftState | null {
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

function hasMeaningfulDraftValue(value: unknown): boolean {
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

async function validateAndPatchAddress(
  flatFields: Partial<ApplicationFormData>,
  currentFormData: ApplicationFormData,
  applyFormPatch: (patch: Partial<ApplicationFormData>) => void,
  appendMessage: (msg: AssistantMessage) => void,
): Promise<void> {
  const streetAddress = (flatFields.address ?? currentFormData.address ?? "").trim()
  const city = (flatFields.city ?? currentFormData.city ?? "").trim()
  const state = (flatFields.state ?? currentFormData.state ?? "MA").trim()
  const zipCode = (flatFields.zip ?? currentFormData.zip ?? "").trim()

  if (!streetAddress || !city) return

  try {
    const addrResp = await authenticatedFetch("/api/address/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streetAddress, city, state: state || "MA", zipCode }),
    })

    if (!addrResp.ok) return

    const addrData = await addrResp.json() as {
      ok: boolean
      valid: boolean
      message: string
      suggestion?: {
        streetAddress: string
        city: string
        state: string
        zipCode: string
        county: string
        displayName: string
      }
    }

    if (addrData.ok && addrData.valid && addrData.suggestion) {
      const s = addrData.suggestion
      applyFormPatch({
        address: s.streetAddress || streetAddress,
        city: s.city || city,
        state: s.state || state,
        zip: s.zipCode || zipCode,
        ...(s.county ? { county: s.county } : {}),
      })
      appendMessage({
        id: createUuid(),
        type: "text",
        role: "assistant",
        content: `✅ Address verified: **${s.displayName}**${s.county ? ` (${s.county})` : ""}`,
      })
    } else if (addrData.ok && !addrData.valid) {
      appendMessage({
        id: createUuid(),
        type: "text",
        role: "assistant",
        content: addrData.suggestion
          ? `⚠️ I couldn't fully verify that address. Did you mean **${addrData.suggestion.displayName}**? If so, just confirm and I'll update it.`
          : `⚠️ I couldn't verify that address. Could you double-check the street, city, and ZIP?`,
      })
    }
  } catch {
    // Address validation is best-effort — silently skip on error
  }
}

export function ApplicationAssistant({
  applicationId,
  actingForPatientId,
  onSwitchToWizard,
  prefillFormData,
}: ApplicationAssistantProps) {
  const dispatch = useAppDispatch()
  const language = useAppSelector((state) => state.app.language) as SupportedLanguage
  const userProfile = useAppSelector((state) => state.userProfile.profile)

  // When prefill data arrives from an upload, generate a fresh UUID so we don't
  // accidentally load a stale draft that would overwrite the extracted fields.
  const [sessionApplicationId] = useState<string>(() => {
    if (prefillFormData && !applicationId) {
      const next = createUuid()
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_ASSISTANT_APPLICATION_KEY, next)
      }
      return next
    }
    return resolveInitialAssistantApplicationId(applicationId)
  })

  // ── Local field mirror ────────────────────────────────────────────────────
  // localFields is updated immediately when extraction returns, so the sidebar
  // and progress bar always reflect the latest data without waiting for the
  // Redux round-trip.  Redux is still updated for persistence.
  const [localFields, setLocalFields] = useState<Partial<ApplicationFormData>>({})

  // Redux snapshot — used as the baseline when loading a pre-existing draft.
  const savedFormData = useAppSelector(
    (state) => state.application.applicationsById[sessionApplicationId]?.newApplicationForm,
  )

  // Merged view: saved draft baseline + in-session updates
  const formData = useMemo<ApplicationFormData>(
    () => ({ ...initialApplicationFormData, ...(savedFormData ?? {}), ...localFields }),
    [savedFormData, localFields],
  )
  const formDataRef = useRef<ApplicationFormData>(formData)

  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [hasAssistantConnectionError, setHasAssistantConnectionError] = useState(false)
  const [editingField, setEditingField] = useState<{ key: keyof ApplicationFormData; value: string } | null>(null)
  const [isAssistantDraftHydrated, setIsAssistantDraftHydrated] = useState(false)
  const [noHouseholdMembers, setNoHouseholdMembers] = useState(false)
  const [noIncome, setNoIncome] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<FormSection>>(new Set(["personal"]))
  const [documentsTriggered, setDocumentsTriggered] = useState(false)

  // "pending"    — waiting for user's yes/no on profile pre-fill
  // "confirming" — reserved for future server-assisted pre-fill continuation
  // "accepted"   — LLM responded after pre-fill; normal chat mode
  // "declined"   — user said no, or no profile exists; start fresh / normal chat mode
  const [profileFillMode, setProfileFillMode] = useState<"pending" | "confirming" | "accepted" | "declined">("declined")

  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const assistantDraftSaveTimerRef = useRef<number | null>(null)
  // Stable ref so startListening's onend can call handleSubmit without a forward-reference
  const handleSubmitRef = useRef<() => void>(() => {})

  // ── Text-to-speech ─────────────────────────────────────────────────────────
  const { speak, stop: stopSpeaking, speaking, supported: ttsSupported } = useSpeechSynthesis()
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)

  const handleSpeak = useCallback(
    (messageId: string, text: string) => {
      if (speakingMessageId === messageId) {
        stopSpeaking()
        setSpeakingMessageId(null)
      } else {
        setSpeakingMessageId(messageId)
        speak(text, language)
      }
    },
    [speakingMessageId, stopSpeaking, speak, language],
  )

  // Clear speaking indicator when synthesis ends naturally
  useEffect(() => {
    if (!speaking) setSpeakingMessageId(null)
  }, [speaking])

  // Auto-read the assistant reply once streaming finishes
  const prevLoadingRef = useRef(false)
  useEffect(() => {
    const justFinished = prevLoadingRef.current && !isLoading
    prevLoadingRef.current = isLoading
    if (!justFinished || !ttsSupported) return
    const last = messages[messages.length - 1]
    if (last?.role === "assistant" && last.content) {
      setSpeakingMessageId(last.id)
      speak(last.content, language)
    }
  }, [isLoading, messages, speak, language, ttsSupported])
  const hydratedAssistantDraftRef = useRef(false)
  const prefillAppliedRef = useRef(false)

  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  const applyFormPatch = useCallback((patch: Partial<ApplicationFormData>) => {
    if (Object.keys(patch).length === 0) return
    formDataRef.current = { ...formDataRef.current, ...patch }
    setLocalFields((prev) => ({ ...prev, ...patch }))
    dispatch(patchNewApplicationForm({ applicationId: sessionApplicationId, patch }))
  }, [dispatch, sessionApplicationId])

  useEffect(() => {
    if (!isAssistantDraftHydrated || messages.length === 0) return

    const recovered = recoverImmediateFieldsFromMessages(
      messages,
      formDataRef.current,
      noHouseholdMembers,
      noIncome,
    )

    if (
      Object.keys(recovered.fields).length > 0 &&
      hasPatchValueChanged(formDataRef.current, recovered.fields)
    ) {
      applyFormPatch(recovered.fields)
    }
    if (recovered.noHouseholdMembers) setNoHouseholdMembers(true)
    if (recovered.noIncome) setNoIncome(true)
  }, [applyFormPatch, isAssistantDraftHydrated, messages, noHouseholdMembers, noIncome])

  // ── Initialise application record ─────────────────────────────────────────
  // useLayoutEffect runs synchronously after DOM paint but before the browser
  // displays anything — no flicker, no mid-render side-effect warnings.

  useLayoutEffect(() => {
    dispatch(createApplication({ applicationId: sessionApplicationId, setActive: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount only

  useEffect(() => {
    let cancelled = false

    const applyDraft = (draft: AssistantDraftState) => {
      if (cancelled) return
      hydratedAssistantDraftRef.current = true
      formDataRef.current = { ...formDataRef.current, ...draft.formData }
      setLocalFields(draft.formData)
      setMessages(draft.messages)
      setDocumentsTriggered(hasDocumentUploadPrompt(draft.messages))
      setNoHouseholdMembers(draft.noHouseholdMembers)
      setNoIncome(draft.noIncome)
      setIsAssistantDraftHydrated(true)
      dispatch(patchNewApplicationForm({
        applicationId: sessionApplicationId,
        patch: draft.formData,
      }))
    }

    const loadDraft = async () => {
      const cacheKey = getAssistantDraftCacheKey(sessionApplicationId)
      try {
        const raw = window.localStorage.getItem(cacheKey)
        const localDraft = raw ? readAssistantDraftState(JSON.parse(raw) as unknown) : null
        if (localDraft) {
          applyDraft(localDraft)
          return
        }
      } catch {
        // Ignore corrupt local cache and fall back to server.
      }

      if (!applicationId) {
        if (!cancelled) setIsAssistantDraftHydrated(true)
        return
      }

      try {
        const headers = actingForPatientId ? { "X-Acting-For-Patient": actingForPatientId } : undefined
        const response = await authenticatedFetch(
          `/api/applications/${encodeURIComponent(sessionApplicationId)}/draft`,
          { method: "GET", cache: "no-store", ...(headers ? { headers } : {}) },
        )
        if (!response.ok) return
        const payload = (await response.json()) as { draftState?: unknown }
        const serverDraft = readAssistantDraftState(payload.draftState)
        if (serverDraft) applyDraft(serverDraft)
      } catch {
        // Draft hydration is best effort; the greeting initializer still works.
      } finally {
        if (!cancelled) setIsAssistantDraftHydrated(true)
      }
    }

    void loadDraft()

    return () => {
      cancelled = true
    }
  }, [actingForPatientId, applicationId, dispatch, sessionApplicationId])

  // Compute current section from form data
  const currentSection = useMemo(
    () => detectCurrentSection(formData, noHouseholdMembers, noIncome),
    [formData, noHouseholdMembers, noIncome],
  )

  const progress = useMemo(
    () => computeProgress(formData, noHouseholdMembers, noIncome),
    [formData, noHouseholdMembers, noIncome],
  )

  // ── Initialise greeting ───────────────────────────────────────────────────

  useEffect(() => {
    if (hydratedAssistantDraftRef.current) return
    let greeting: string

    if (prefillFormData && !prefillAppliedRef.current) {
      // Document upload flow — apply extracted fields then ask about the first missing one.
      prefillAppliedRef.current = true
      const nonEmpty = Object.fromEntries(
        Object.entries(prefillFormData).filter(([, v]) => v !== "" && v !== undefined && v !== null),
      ) as Partial<ApplicationFormData>
      if (Object.keys(nonEmpty).length > 0) {
        applyFormPatch(nonEmpty)
        const mergedData = { ...formDataRef.current, ...nonEmpty }
        const firstQuestion = getNextMissingApplicationQuestion(mergedData)
        const fieldCount = Object.keys(nonEmpty).length
        greeting = `I pre-filled ${fieldCount} field${fieldCount === 1 ? "" : "s"} from your uploaded document. ${firstQuestion ?? "Everything looks complete — let's review your application."}`
      } else {
        greeting = getFormAssistantGreeting(language)
      }
      setProfileFillMode("declined")
    } else if (userProfile?.firstName) {
      // We have a profile — offer to pre-fill.
      const summary: ProfilePreFillSummary = {
        firstName: userProfile.firstName,
        hasLastName: Boolean(userProfile.lastName),
        hasDob: Boolean(userProfile.dateOfBirth),
        hasPhone: Boolean(userProfile.phone),
        hasAddress: Boolean(userProfile.addressLine1),
      }
      greeting = getProfileAwareFormAssistantGreeting(summary, language)
      setProfileFillMode("pending")
    } else {
      // No profile — start the standard question flow.
      greeting = getFormAssistantGreeting(language)
      setProfileFillMode("declined")
    }

    setMessages([
      {
        id: createUuid(),
        type: "text",
        role: "assistant",
        content: greeting,
      },
    ])
    // Focus textarea so user can start typing immediately
    textareaRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]) // intentionally omit userProfile/prefillFormData — greeting is set once on mount/language change

  // Safety net: if the draft loader fires after the greeting (race condition),
  // re-apply prefill so the draft doesn't silently overwrite extracted fields.
  useEffect(() => {
    if (!isAssistantDraftHydrated || !prefillFormData || prefillAppliedRef.current) return
    prefillAppliedRef.current = true
    const nonEmpty = Object.fromEntries(
      Object.entries(prefillFormData).filter(([, v]) => v !== "" && v !== undefined && v !== null),
    ) as Partial<ApplicationFormData>
    if (Object.keys(nonEmpty).length > 0) {
      applyFormPatch(nonEmpty)
    }
  }, [isAssistantDraftHydrated, prefillFormData, applyFormPatch])

  // ── Trigger document upload prompts when reaching documents section ────────

  useEffect(() => {
    if (
      currentSection === "documents" &&
      !documentsTriggered &&
      !hasDocumentUploadPrompt(messages) &&
      messages.length > 1
    ) {
      setDocumentsTriggered(true)
      setMessages((prev) => [
        ...prev,
        {
          id: createUuid(),
          type: "upload_prompt",
          role: "assistant",
          content:
            "Great work! I've collected all your form information. Now let's upload a few supporting documents to complete your application. You can upload each one below:",
          docTypes: REQUIRED_DOCS,
        },
      ])
    }
  }, [currentSection, documentsTriggered, messages])

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Auto-focus textarea after assistant replies ───────────────────────────

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus()
    }
  }, [isLoading])

  // ── Auto-expand the active section in sidebar ──────────────────────────────

  useEffect(() => {
    setExpandedSections((prev) => new Set([...prev, currentSection]))
  }, [currentSection])

  // ── Draft save ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAssistantDraftHydrated) return
    if (!hasPersistableAssistantDraft(localFields, messages, noHouseholdMembers, noIncome)) return

    const draft = createAssistantDraftState(formData, messages, noHouseholdMembers, noIncome)
    const cacheKey = getAssistantDraftCacheKey(sessionApplicationId)
    window.localStorage.setItem(cacheKey, JSON.stringify(draft))

    if (assistantDraftSaveTimerRef.current) {
      window.clearTimeout(assistantDraftSaveTimerRef.current)
    }

    assistantDraftSaveTimerRef.current = window.setTimeout(() => {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (actingForPatientId) headers["X-Acting-For-Patient"] = actingForPatientId

      void authenticatedFetch(`/api/applications/${encodeURIComponent(sessionApplicationId)}/draft`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          wizardState: { formAssistant: draft },
          applicationType: formData.applicationType || undefined,
        }),
      }).catch(() => {
        // Local cache still preserves progress if the server save is temporarily unavailable.
      })
    }, 800)

    return () => {
      if (assistantDraftSaveTimerRef.current) {
        window.clearTimeout(assistantDraftSaveTimerRef.current)
      }
    }
  }, [
    actingForPatientId,
    formData,
    isAssistantDraftHydrated,
    localFields,
    messages,
    noHouseholdMembers,
    noIncome,
    sessionApplicationId,
  ])

  // ── Voice input ───────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    type SpeechRecognitionResultList = {
      readonly length: number
      [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }
    }
    type SpeechRecognitionInstance = {
      lang: string
      continuous: boolean
      interimResults: boolean
      start(): void
      stop(): void
      onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null
      onend: (() => void) | null
      onerror: ((event: { error: string }) => void) | null
    }
    type SpeechRecognitionCtor = new () => SpeechRecognitionInstance
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const SpeechRecognitionAPI = win.SpeechRecognition ?? win.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setInputError("Voice input is not supported in this browser. Try Chrome.")
      return
    }

    // Explicitly request mic permission first — this triggers the browser dialog.
    // Without this, browsers that previously saw a denial skip the dialog silently.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission granted — release the stream immediately; SpeechRecognition
      // will open its own handle.
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      setInputError("Microphone access was denied. Click the 🔒 icon in the address bar to allow it.")
      return
    }

    setInputError("")
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = SPEECH_LANG[language] ?? "en-US"
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let transcript = ""
      // Use event.results.length (a DOM list property) — NOT Object.keys() which returns 0
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      // Auto-submit whatever was transcribed
      handleSubmitRef.current()
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      recognitionRef.current = null
      if (event.error !== "no-speech") {
        setInputError("Voice input error. Please try again.")
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [language])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  // ── Input field-type detection ────────────────────────────────────────────
  // Must be declared BEFORE handleSubmit so the dep-array reference is valid.

  const lastAssistantContent = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === "assistant" && m.type === "text") return (m as TextMessage).content
    }
    return ""
  }, [messages])

  const inputFieldType = useMemo(
    // Bypass field-type detection while the profile pre-fill flow is in progress
    // (pending = yes/no prompt, confirming = confirmation shown, LLM not yet called).
    () => (profileFillMode === "pending" || profileFillMode === "confirming")
      ? "text"
      : detectInputFieldType(lastAssistantContent),
    [lastAssistantContent, profileFillMode],
  )

  const quickReplies = useMemo(
    () => getQuickRepliesForAssistantPrompt(lastAssistantContent, profileFillMode),
    [lastAssistantContent, profileFillMode],
  )

  const selectedInputDate = useMemo(() => parseCalendarDate(input), [input])

  // ── Chat submission ───────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e?: FormEvent, quickReplyValue?: string) => {
      e?.preventDefault()
      let trimmed = (quickReplyValue ?? input).trim()
      if (!trimmed || isLoading) return

      if (containsSsnLikeContent(trimmed)) {
        setInput("")
        setInputError("")
        setHasAssistantConnectionError(false)
        setMessages((prev) => [
          ...prev,
          {
            id: createUuid(),
            type: "text",
            role: "assistant",
            content: SSN_CHAT_HANDOFF_MESSAGE,
          },
        ])
        textareaRef.current?.focus()
        return
      }

      // ── Profile pre-fill yes/no intercept ──────────────────────────────
      // This fires only once — while the greeting is awaiting the user's answer.
      if (profileFillMode === "pending") {
        const normalized = trimmed.toLowerCase().replace(/[^a-z]/g, "")
        const isYes = /^(yes|yeah|yep|yup|sure|ok|okay|oui|si|sim|wi|co|co|vang|да)/.test(normalized)
        const isNo = /^(no|nope|nah|non|não|nò|không|не)/.test(normalized)

        const userMessage: TextMessage = {
          id: createUuid(),
          type: "text",
          role: "user",
          content: trimmed,
        }
        setMessages((prev) => [...prev, userMessage])
        setInput("")

        if (isYes && userProfile) {
          // Pre-fill from profile
          const preFilled = buildPreFillFromProfile(userProfile)
          const mergedFormData = { ...formDataRef.current, ...preFilled }
          applyFormPatch(preFilled)
          const appliedLabels = describedAppliedFields(userProfile)
          const confirmMsg = getProfilePreFillConfirmation(appliedLabels, language)
          const nextQuestion = getNextMissingApplicationQuestion(mergedFormData, noHouseholdMembers, noIncome)
          setMessages((prev) => [
            ...prev,
            { id: createUuid(), type: "text", role: "assistant", content: `${confirmMsg} ${nextQuestion}` },
          ])
          setProfileFillMode("accepted")
        } else {
          // Declined or unclear — start fresh
          setProfileFillMode("declined")
          const declineMsg = getProfilePreFillDeclineResponse(language)
          setMessages((prev) => [
            ...prev,
            { id: createUuid(), type: "text", role: "assistant", content: declineMsg },
          ])
        }

        textareaRef.current?.focus()
        return // Do not call the LLM for yes/no
      }

      // ── Email validation guard ──────────────────────────────────────────
      if (inputFieldType === "email" && !isValidEmail(trimmed)) {
        setInputError("Please enter a valid email address (e.g. name@example.com)")
        return
      }

      // ── Date normalization ──────────────────────────────────────────────
      // Convert "Jan 17, 80", "1/17/80", etc. → "01/17/1980" before the message
      // is shown in the chat and sent to the API.
      if (inputFieldType === "date") {
        trimmed = parseNaturalDate(trimmed)
      }

      setInputError("")

      const userMessage: TextMessage = {
        id: createUuid(),
        type: "text",
        role: "user",
        content: trimmed,
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsLoading(true)
      setHasAssistantConnectionError(false)

      // Build API messages (text only, no upload_prompt messages)
      const apiMessages: ApiChatMessage[] = messages
        .filter((m): m is TextMessage => m.type === "text")
        .map((m) => ({ role: m.role, content: m.content }))
      apiMessages.push({ role: "user", content: trimmed })

      const liveFormData = formDataRef.current
      let requestFormData = liveFormData
      let requestNoHouseholdMembers = noHouseholdMembers
      let requestNoIncome = noIncome
      const immediatePatch = getImmediateFieldPatchFromAnswer(
        trimmed,
        lastAssistantContent,
        liveFormData,
        detectCurrentSection(liveFormData, noHouseholdMembers, noIncome),
        inputFieldType,
      )
      if (
        Object.keys(immediatePatch.fields).length > 0 ||
        immediatePatch.noHouseholdMembers ||
        immediatePatch.noIncome
      ) {
        if (Object.keys(immediatePatch.fields).length > 0) {
          requestFormData = { ...requestFormData, ...immediatePatch.fields }
          applyFormPatch(immediatePatch.fields)
        }
        if (immediatePatch.noHouseholdMembers) {
          requestNoHouseholdMembers = true
          setNoHouseholdMembers(true)
        }
        if (immediatePatch.noIncome) {
          requestNoIncome = true
          setNoIncome(true)
        }
      }
      const collectedSummary = summarizeCollectedFields(requestFormData)
      const requestSection = detectCurrentSection(requestFormData, requestNoHouseholdMembers, requestNoIncome)

      try {
        const response = await authenticatedFetch("/api/chat/masshealth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            language,
            mode: "form_assistant",
            currentFields: collectedSummary,
            currentSection: requestSection,
            existingMembers: requestFormData.householdMembers,
            existingSources: requestFormData.incomeSources,
          }),
        })

        if (!response.ok) {
          const detail = await response.text().catch(() => "")
          throw new Error(`API error ${response.status}${detail ? `: ${detail}` : ""}`)
        }

        // Add a streaming placeholder for the assistant reply
        const placeholderId = createUuid()
        setMessages((prev) => [
          ...prev,
          { id: placeholderId, type: "text" as const, role: "assistant" as const, content: "" },
        ])

        const { text, annotation } = await readChatStream(response, (_token, accumulated) => {
          setMessages((prev) =>
            prev.map((m) => m.id === placeholderId ? { ...m, content: accumulated } : m),
          )
        })

        const finalReply = annotation?.reply && typeof annotation.reply === "string"
          ? annotation.reply.trim()
          : text.trim()
        if (!finalReply) throw new Error("No reply from assistant")
        setHasAssistantConnectionError(false)

        // Finalise the streamed message
        setMessages((prev) =>
          prev.map((m) => m.id === placeholderId ? { ...m, content: finalReply } : m),
        )

        // Structured fields come from the data annotation (arrives before text tokens)
        const data = {
          extractedFields: annotation?.extractedFields as Partial<ApplicationFormData> | undefined,
          noHouseholdMembers: annotation?.noHouseholdMembers as boolean | undefined,
          noIncome: annotation?.noIncome as boolean | undefined,
          reply: finalReply,
        }

        // Apply extracted fields — update localFields immediately for instant UI
        // feedback, then also persist to Redux for cross-tab/draft continuity.
        if (data.extractedFields && Object.keys(data.extractedFields).length > 0) {
          const previousFormData = formDataRef.current
          const { householdMembers, incomeSources, ...flatFields } = data.extractedFields

          // ── 1. Merge new household members ─────────────────────────────────
          let mergedMembers: HouseholdMember[] | undefined
          if (Array.isArray(householdMembers) && householdMembers.length > 0) {
            const existingIds = new Set(previousFormData.householdMembers.map((m) => m.id))
            const newMembers = householdMembers.filter((m) => !existingIds.has(m.id))
            if (newMembers.length > 0) {
              mergedMembers = [...previousFormData.householdMembers, ...newMembers]
            }
          }

          // ── 2. Merge new income sources ─────────────────────────────────────
          let mergedSources: IncomeSource[] | undefined
          if (Array.isArray(incomeSources) && incomeSources.length > 0) {
            const existingIds = new Set(previousFormData.incomeSources.map((s) => s.id))
            const newSources = incomeSources.filter((s) => !existingIds.has(s.id))
            if (newSources.length > 0) {
              mergedSources = [...previousFormData.incomeSources, ...newSources]
            }
          }

          const addressChanged =
            (flatFields.address !== undefined && flatFields.address !== previousFormData.address) ||
            (flatFields.city !== undefined && flatFields.city !== previousFormData.city) ||
            (flatFields.zip !== undefined && flatFields.zip !== previousFormData.zip)

          // ── 3. Update local state immediately (drives sidebar + progress) ───
          applyFormPatch({
            ...flatFields,
            ...(mergedMembers ? { householdMembers: mergedMembers } : {}),
            ...(mergedSources ? { incomeSources: mergedSources } : {}),
          })
          dispatch(setActiveApplication(sessionApplicationId))

          // Only re-validate when address fields actually changed — re-extracting
          // previously-known address data from history must not retrigger validation.
          if (addressChanged) {
            await validateAndPatchAddress(
              flatFields,
              previousFormData,
              applyFormPatch,
              (msg) => setMessages((prev) => [...prev, msg]),
            )
          }

        }

        if (data.noHouseholdMembers) setNoHouseholdMembers(true)
        if (data.noIncome) setNoIncome(true)
        // Reply already applied to the streaming placeholder above
      } catch (error) {
        console.error("Compass chat request failed", error)
        setHasAssistantConnectionError(true)
        setMessages((prev) => [
          ...prev.filter((message) => message.content.trim().length > 0),
          {
            id: createUuid(),
            type: "text",
            role: "assistant",
            content: ASSISTANT_CONNECTION_FAILURE_MESSAGE,
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [applyFormPatch, dispatch, input, isLoading, messages, language, sessionApplicationId, inputFieldType, profileFillMode, userProfile, noHouseholdMembers, noIncome, lastAssistantContent],
  )

  // Keep the ref in sync so startListening's onend always calls the latest version
  useEffect(() => {
    handleSubmitRef.current = () => void handleSubmit()
  }, [handleSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  const saveEditedField = useCallback(() => {
    if (!editingField) return
    const patch = { [editingField.key]: editingField.value } as Partial<ApplicationFormData>
    applyFormPatch(patch)
    setEditingField(null)
  }, [applyFormPatch, editingField])

  const toggleSection = useCallback((section: FormSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }, [])

  const [inputError, setInputError] = useState<string>("")

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const raw = e.target.value
      setInputError("")

      switch (inputFieldType) {
        case "phone":
          setInput(formatPhone(raw))
          break
        case "ssn":
          setInput(formatSSN(raw))
          break
        case "date":
          // Only auto-format if the user is typing pure digits (+ already-inserted slashes)
          // If they type letters (e.g. "Jan"), let them type freely and parse on submit
          if (/^[\d/]*$/.test(raw)) {
            setInput(formatDateDigits(raw.replace(/\//g, "")))
          } else {
            setInput(raw)
          }
          break
        case "money":
          // Only auto-format if input looks like a number (no sentences)
          if (/^[$\d,.\s]*$/.test(raw)) {
            setInput(formatMoney(raw))
          } else {
            setInput(raw)
          }
          break
        default:
          setInput(raw)
      }
    },
    [inputFieldType],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[600px] gap-4">
      {/* ── Left: Chat panel ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <CompassIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Compass</p>
              <p className="text-xs text-muted-foreground capitalize">{SECTION_LABELS[currentSection]} step</p>
            </div>
          </div>
          {/* Language selector */}
          <div className="flex items-center gap-1">
            {SUPPORTED_LANGUAGES.map(({ code }) => (
              <button
                key={code}
                onClick={() => dispatch(setLanguage(code))}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  language === code
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              applicationId={sessionApplicationId}
              onSpeak={ttsSupported ? (text) => handleSpeak(message.id, text) : undefined}
              isSpeaking={speakingMessageId === message.id}
            />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <CompassIcon className="h-4 w-4" />
              </div>
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-4">
          {hasAssistantConnectionError && (
            <div className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="text-foreground">
                The AI engine is not responding. You can keep this page open and try again, or continue in the Form Wizard.
              </p>
              {onSwitchToWizard && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={onSwitchToWizard}
                >
                  Continue in Form Wizard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {quickReplies.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {quickReplies.map((reply) => (
                <Button
                  key={`${reply.label}-${reply.value}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={isLoading}
                  onClick={() => void handleSubmit(undefined, reply.value)}
                >
                  {reply.label}
                </Button>
              ))}
            </div>
          )}
          {inputFieldType === "date" && !isLoading && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    Pick date
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0" sideOffset={8}>
                  <Calendar
                    mode="single"
                    selected={selectedInputDate}
                    defaultMonth={selectedInputDate ?? new Date(1990, 0, 1)}
                    captionLayout="dropdown"
                    startMonth={new Date(1900, 0, 1)}
                    endMonth={new Date()}
                    disabled={(date) => date > new Date()}
                    onSelect={(date) => {
                      if (!date) return
                      setInput(formatCalendarDate(date))
                      setInputError("")
                      setDatePickerOpen(false)
                      window.setTimeout(() => textareaRef.current?.focus(), 0)
                    }}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">
                Or type the date as MM/DD/YYYY.
              </span>
            </div>
          )}
          <form onSubmit={(e) => void handleSubmit(e)} className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                inputFieldType === "phone" ? "(xxx) xxx-xxxx" :
                inputFieldType === "ssn"   ? "xxx-xx-xxxx" :
                inputFieldType === "date"  ? "MM/DD/YYYY or Jan 17, 1980" :
                inputFieldType === "email" ? "name@example.com" :
                inputFieldType === "money" ? "$0,000" :
                "Type your answer or click the mic to speak…"
              }
              className={cn(
                "min-h-[44px] max-h-32 resize-none",
                inputError && "border-destructive focus-visible:ring-destructive",
              )}
              rows={1}
              disabled={isLoading}
            />
            <div className="flex shrink-0 flex-col gap-1">
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={isListening ? stopListening : () => void startListening()}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>

          {/* Format hint or validation error */}
          {inputError ? (
            <p className="mt-1 text-xs text-destructive">{inputError}</p>
          ) : inputFieldType !== "text" && !isListening ? (
            <p className="mt-1 text-xs text-muted-foreground">{FIELD_TYPE_HINT[inputFieldType]}</p>
          ) : null}

          {isListening && (
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <Volume2 className="h-3 w-3" />
              Listening… speak clearly, then pause
            </p>
          )}
        </div>
      </div>

      {/* ── Right: Progress sidebar ──────────────────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
        {/* Overall progress */}
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Application Progress</p>
            <Badge variant={progress === 100 ? "default" : "secondary"} className="text-xs">
              {progress}%
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            {progress < 100
              ? `Complete the ${SECTION_LABELS[currentSection]} step`
              : "All sections complete — upload documents to finish"}
          </p>
        </div>

        {/* Section accordions */}
        <div className="rounded-xl border bg-background shadow-sm">
          {SECTION_ORDER.map((section, index) => {
            const isComplete = isSectionComplete(formData ?? ({} as ApplicationFormData), section, noHouseholdMembers, noIncome)
            const isActive = section === currentSection
            const isExpanded = expandedSections.has(section)
            const fields = getSectionFields(formData ?? ({} as ApplicationFormData), section)

            return (
              <div key={section} className={cn("border-b last:border-b-0", isActive && "bg-primary/5")}>
                <button
                  onClick={() => toggleSection(section)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Circle
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isActive && "text-primary",
                        isComplete && "text-green-700",
                      )}
                    >
                      {index + 1}. {SECTION_LABELS[section]}
                    </span>
                    {isActive && (
                      <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px] text-primary">
                        Active
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-1 px-4 pb-3">
                    {fields.map((field) => {
                      const isEditing = editingField?.key === field.key
                      const activeEdit = isEditing ? editingField : null
                      return (
                        <div key={field.label} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{field.label}</span>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="icon-sm" onClick={saveEditedField} aria-label={`Save ${field.label}`}>
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditingField(null)} aria-label={`Cancel ${field.label}`}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={cn(
                                  "group flex min-w-0 items-center gap-1 text-right",
                                  field.editable && "hover:text-primary",
                                )}
                                disabled={!field.editable || !field.key}
                                onClick={() => {
                                  if (!field.editable || !field.key) return
                                  setEditingField({ key: field.key, value: field.value })
                                }}
                                title={field.editable ? `Edit ${field.label}` : undefined}
                              >
                                {field.value ? (
                                  <span className="max-w-[120px] truncate text-xs font-medium text-green-700">
                                    {field.value}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                                {field.editable && <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />}
                              </button>
                            )}
                          </div>
                          {activeEdit && (
                            <input
                              value={activeEdit.value}
                              onChange={(event) => setEditingField({ key: activeEdit.key, value: event.target.value })}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") saveEditedField()
                                if (event.key === "Escape") setEditingField(null)
                              }}
                              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary"
                              autoFocus
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Switch to wizard */}
        {onSwitchToWizard && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={onSwitchToWizard}
          >
            <span>Review in Form Wizard</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {/* Help note */}
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          Your information is saved automatically as you chat. SSN is collected securely in the wizard.
        </p>
      </div>
    </div>
  )
}

// ── Message bubble sub-component ──────────────────────────────────────────────

function MessageBubble({
  message,
  applicationId,
  onSpeak,
  isSpeaking,
}: {
  message: AssistantMessage
  applicationId: string
  onSpeak?: (text: string) => void
  isSpeaking?: boolean
}) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-2">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
      </div>
    )
  }

  if (message.type === "upload_prompt") {
    return (
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <CompassIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
            {message.content}
          </div>
          <div className="space-y-2">
            {message.docTypes.map((doc) => (
              <DocumentUploader
                key={doc.type}
                applicationId={applicationId}
                documentType={doc.type}
                requiredDocumentLabel={doc.label}
                title={doc.label}
                description={doc.description}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Standard assistant text message
  return (
    <div className="group flex items-start gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <CompassIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="relative max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm leading-relaxed">
        {message.content}
        {onSpeak && message.content && (
          <button
            type="button"
            aria-label={isSpeaking ? "Stop reading" : "Read aloud"}
            onClick={() => onSpeak(message.content)}
            className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          >
            {isSpeaking
              ? <VolumeX className="h-3 w-3" />
              : <Volume2 className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  )
}
