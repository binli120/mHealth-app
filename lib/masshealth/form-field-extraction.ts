import "server-only"

import type { SupportedLanguage } from "@/lib/i18n/languages"
import { DEFAULT_OLLAMA_BASE_URL, OLLAMA_CHAT_ENDPOINT } from "@/lib/rag/constants"
import type { ChatMessage, OllamaResponse } from "./types"
import type { ApplicationFormData, HouseholdMember, IncomeSource } from "@/lib/redux/features/application-slice"
import {
  EXTRACT_TEMPERATURE,
  EXTRACT_TIMEOUT_MS,
  EXTRACT_MESSAGE_WINDOW,
} from "./constants"
import type { FormSection } from "./form-sections"

// Re-export for server-side consumers
export type { FormSection }
export { summarizeCollectedFields, detectCurrentSection } from "./form-sections"

const EXTRACT_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2"

// ── Types ─────────────────────────────────────────────────────────────────────

/** Subset of ApplicationFormData that can be safely extracted via LLM (no SSN). */
export type ExtractableFormFields = Omit<ApplicationFormData, "ssn" | "certify" | "aca3QuestionResponses" | "documents">

// ── Extraction prompt ─────────────────────────────────────────────────────────

function buildFormFieldExtractionPrompt(collectedSummary: string, currentSection: FormSection): string {
  return [
    "You are a structured data extractor for a MassHealth application form.",
    "Your ONLY job is to read the conversation below and output a single JSON object",
    "containing any form fields the user has provided in this conversation.",
    "",
    "Output ONLY valid JSON. No prose, no explanation, no markdown fences.",
    "If a field was not mentioned in this conversation, omit the key entirely.",
    "Never invent or assume data — only extract what the user explicitly stated.",
    "Do NOT extract SSN (Social Security Number) — that is collected separately.",
    "",
    "JSON schema (all fields optional, extract only what user stated):",
    "{",
    '  "firstName": "string — applicant first name",',
    '  "lastName": "string — applicant last name",',
    '  "dob": "string — date of birth in MM/DD/YYYY format",',
    '  "phone": "string — primary phone number, digits only or standard format",',
    '  "email": "string — email address",',
    '  "address": "string — street address line 1",',
    '  "apartment": "string — apt/unit number if any",',
    '  "city": "string — city name",',
    '  "state": "string — 2-letter state code, default MA",',
    '  "zip": "string — 5-digit ZIP code",',
    '  "citizenship": "string — one of: citizen, permanent_resident, qualified_immigrant, undocumented, other",',
    '  "householdMembers": [',
    '    {',
    '      "firstName": "string",',
    '      "lastName": "string",',
    '      "relationship": "string — e.g. spouse, child, parent, sibling",',
    '      "dob": "string — MM/DD/YYYY if provided"',
    '    }',
    '  ],',
    '  "incomeSources": [',
    '    {',
    '      "type": "string — e.g. employment, self_employment, social_security, disability, unemployment, other",',
    '      "employer": "string — employer name if employment",',
    '      "amount": "string — dollar amount as stated",',
    '      "frequency": "string — one of: weekly, biweekly, monthly, annually"',
    '    }',
    '  ],',
    '  "noHouseholdMembers": true,  // set ONLY if user explicitly says they live alone / no other household members',
    '  "noIncome": true             // set ONLY if user explicitly says they have no income',
    "}",
    "",
    "Parsing rules:",
    '- "my wife Sarah" → householdMembers: [{firstName: "Sarah", relationship: "spouse"}]',
    '- "I live with my son Tom, born March 5 2015" → [{firstName: "Tom", relationship: "child", dob: "03/05/2015"}]',
    '- "I make $3,000 a month at my job at CVS" → incomeSources: [{type: "employment", employer: "CVS", amount: "3000", frequency: "monthly"}]',
    '- "I receive SSI of $900/month" → incomeSources: [{type: "disability", amount: "900", frequency: "monthly"}]',
    '- "I live alone" → noHouseholdMembers: true',
    '- "I don\'t have income" → noIncome: true',
    '- "I live in Boston MA, zip 02101" → city: "Boston", state: "MA", zip: "02101"',
    "",
    `Currently active section: ${currentSection}`,
    `Already collected (do NOT re-extract these unless user explicitly corrects them):`,
    collectedSummary || "Nothing collected yet.",
  ].join("\n")
}

// ── Ollama call ───────────────────────────────────────────────────────────────

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "")
}

async function callOllamaForFormJson(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      stream: false,
      options: { temperature: EXTRACT_TEMPERATURE },
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-EXTRACT_MESSAGE_WINDOW),
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama form extraction failed: HTTP ${response.status}`)
  }

  const data = (await response.json()) as OllamaResponse
  return data.message?.content?.trim() ?? ""
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function normalizeDate(raw: string): string {
  if (!raw) return ""
  // Already in MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw
  // Try to parse common formats
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${mm}/${dd}/${yyyy}`
  }
  return raw
}

const VALID_CITIZENSHIP = new Set(["citizen", "permanent_resident", "qualified_immigrant", "undocumented", "other"])
const VALID_INCOME_FREQ = new Set(["weekly", "biweekly", "monthly", "annually"])

interface RawExtracted {
  firstName?: unknown
  lastName?: unknown
  dob?: unknown
  phone?: unknown
  email?: unknown
  address?: unknown
  apartment?: unknown
  city?: unknown
  state?: unknown
  zip?: unknown
  citizenship?: unknown
  householdMembers?: unknown
  incomeSources?: unknown
  noHouseholdMembers?: unknown
  noIncome?: unknown
}

function parseExtractedFormFields(
  raw: string,
  existingMembers: HouseholdMember[],
  existingSources: IncomeSource[],
): { fields: Partial<ExtractableFormFields>; noHouseholdMembers: boolean; noIncome: boolean } {
  const cleaned = raw
    .replace(/^```(?:json)?/m, "")
    .replace(/```$/m, "")
    .trim()

  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) return { fields: {}, noHouseholdMembers: false, noIncome: false }

  let parsed: RawExtracted
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as RawExtracted
  } catch {
    return { fields: {}, noHouseholdMembers: false, noIncome: false }
  }

  const fields: Partial<ExtractableFormFields> = {}

  if (typeof parsed.firstName === "string" && parsed.firstName.trim()) {
    fields.firstName = parsed.firstName.trim()
  }
  if (typeof parsed.lastName === "string" && parsed.lastName.trim()) {
    fields.lastName = parsed.lastName.trim()
  }
  if (typeof parsed.dob === "string" && parsed.dob.trim()) {
    fields.dob = normalizeDate(parsed.dob.trim())
  }
  if (typeof parsed.phone === "string" && parsed.phone.trim()) {
    fields.phone = parsed.phone.replace(/\D/g, "").slice(0, 10)
  }
  if (typeof parsed.email === "string" && parsed.email.includes("@")) {
    fields.email = parsed.email.trim().toLowerCase()
  }
  if (typeof parsed.address === "string" && parsed.address.trim()) {
    fields.address = parsed.address.trim()
  }
  if (typeof parsed.apartment === "string") {
    fields.apartment = parsed.apartment.trim()
  }
  if (typeof parsed.city === "string" && parsed.city.trim()) {
    fields.city = parsed.city.trim()
  }
  if (typeof parsed.state === "string" && parsed.state.trim().length >= 2) {
    fields.state = parsed.state.trim().toUpperCase().slice(0, 2)
  }
  if (typeof parsed.zip === "string" && /\d{5}/.test(parsed.zip)) {
    const match = parsed.zip.match(/\d{5}/)
    if (match) fields.zip = match[0]
  }
  if (typeof parsed.citizenship === "string" && VALID_CITIZENSHIP.has(parsed.citizenship)) {
    fields.citizenship = parsed.citizenship
  }

  // Household members — merge with existing, avoid exact duplicates
  if (Array.isArray(parsed.householdMembers) && parsed.householdMembers.length > 0) {
    const existingNames = new Set(
      existingMembers.map((m) => `${m.firstName.toLowerCase()}|${m.lastName.toLowerCase()}`)
    )

    const newMembers: HouseholdMember[] = []
    for (const rawMember of parsed.householdMembers as Record<string, unknown>[]) {
      if (typeof rawMember !== "object" || !rawMember) continue
      const firstName = typeof rawMember.firstName === "string" ? rawMember.firstName.trim() : ""
      const lastName = typeof rawMember.lastName === "string" ? rawMember.lastName.trim() : ""
      const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`
      if (existingNames.has(key)) continue
      existingNames.add(key)
      newMembers.push({
        id: crypto.randomUUID(),
        firstName,
        lastName,
        relationship: typeof rawMember.relationship === "string" ? rawMember.relationship.trim() : "",
        dob: typeof rawMember.dob === "string" ? normalizeDate(rawMember.dob) : "",
        ssn: "",
        pregnant: false,
        disabled: false,
        over65: false,
      })
    }

    if (newMembers.length > 0) {
      fields.householdMembers = [...existingMembers, ...newMembers]
    }
  }

  // Income sources — merge with existing, avoid exact duplicates
  if (Array.isArray(parsed.incomeSources) && parsed.incomeSources.length > 0) {
    const existingTypes = new Set(existingSources.map((s) => s.type.toLowerCase()))
    const newSources: IncomeSource[] = []

    for (const rawSource of parsed.incomeSources as Record<string, unknown>[]) {
      if (typeof rawSource !== "object" || !rawSource) continue
      const type = typeof rawSource.type === "string" ? rawSource.type.trim() : "other"
      if (existingTypes.has(type.toLowerCase())) continue
      existingTypes.add(type.toLowerCase())
      newSources.push({
        id: crypto.randomUUID(),
        type,
        employer: typeof rawSource.employer === "string" ? rawSource.employer.trim() : "",
        amount: typeof rawSource.amount === "string" ? rawSource.amount.trim() : "",
        frequency: typeof rawSource.frequency === "string" && VALID_INCOME_FREQ.has(rawSource.frequency as string)
          ? (rawSource.frequency as string)
          : "monthly",
      })
    }

    if (newSources.length > 0) {
      fields.incomeSources = [...existingSources, ...newSources]
    }
  }

  return {
    fields,
    noHouseholdMembers: parsed.noHouseholdMembers === true,
    noIncome: parsed.noIncome === true,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FormExtractionResult {
  fields: Partial<ExtractableFormFields>
  noHouseholdMembers: boolean
  noIncome: boolean
}

/**
 * Extract structured form fields from the conversation using the LLM.
 * Returns only fields the user explicitly stated. Never includes SSN.
 * Returns empty result on failure (graceful degradation).
 */
export async function extractFormFields(
  messages: ChatMessage[],
  collectedSummary: string,
  currentSection: FormSection,
  existingMembers: HouseholdMember[],
  existingSources: IncomeSource[],
  _language: SupportedLanguage,
): Promise<FormExtractionResult> {
  try {
    const systemPrompt = buildFormFieldExtractionPrompt(collectedSummary, currentSection)
    const raw = await callOllamaForFormJson(systemPrompt, messages)
    return parseExtractedFormFields(raw, existingMembers, existingSources)
  } catch {
    return { fields: {}, noHouseholdMembers: false, noIncome: false }
  }
}
