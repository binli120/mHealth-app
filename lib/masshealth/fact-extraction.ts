import "server-only"

import type { CitizenshipStatus, ScreenerData } from "@/lib/eligibility-engine"
import type { ChatMessage } from "./chat-knowledge"
import type { SupportedLanguage } from "@/lib/i18n/languages"

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
const OLLAMA_CHAT_ENDPOINT = "/api/chat"
const EXTRACT_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2"
const EXTRACT_TEMPERATURE = 0
const EXTRACT_TIMEOUT_MS = 30_000
// Use last N messages to keep extraction prompt focused
const EXTRACT_MESSAGE_WINDOW = 10

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildFactExtractionPrompt(): string {
  return [
    "You are a structured data extractor. Your ONLY job is to read the conversation below",
    "and output a single JSON object containing any eligibility facts the user has stated.",
    "",
    "Output ONLY valid JSON. No prose, no explanation, no markdown fences.",
    "If a fact was not mentioned, omit the key entirely (do not output null).",
    "",
    "JSON schema (all fields optional):",
    "{",
    '  "livesInMA": boolean,           // true if user says they live in Massachusetts/MA',
    '  "age": number,                  // applicant age in years',
    '  "householdSize": number,        // total people in household including applicant',
    '  "annualIncome": number,         // total household annual income in USD (convert monthly × 12)',
    '  "isPregnant": boolean,          // true if applicant is pregnant',
    '  "hasDisability": boolean,       // true if applicant has documented disability or receives SSI/SSDI',
    '  "hasMedicare": boolean,         // true if applicant is enrolled in Medicare',
    '  "hasEmployerInsurance": boolean,// true if applicant has employer-sponsored health insurance',
    '  "citizenshipStatus": string     // one of: "citizen" | "qualified_immigrant" | "undocumented" | "other"',
    "}",
    "",
    "Examples:",
    '- "I am 34 years old" → { "age": 34 }',
    '- "family of 4, we earn about $3,000 a month" → { "householdSize": 4, "annualIncome": 36000 }',
    '- "I live in Boston" → { "livesInMA": true }',
    '- "I receive SSI" → { "hasDisability": true }',
    '- "I am a US citizen" → { "citizenshipStatus": "citizen" }',
    '- "I am undocumented" → { "citizenshipStatus": "undocumented" }',
  ].join("\n")
}

// ── Ollama call ───────────────────────────────────────────────────────────────

function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "")
}

interface OllamaResponse {
  message?: { content?: string }
}

async function callOllamaForJson(messages: ChatMessage[]): Promise<string> {
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
        { role: "system", content: buildFactExtractionPrompt() },
        ...messages.slice(-EXTRACT_MESSAGE_WINDOW),
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama fact extraction failed: HTTP ${response.status}`)
  }

  const data = (await response.json()) as OllamaResponse
  return data.message?.content?.trim() ?? ""
}

// ── JSON parsing with safety ──────────────────────────────────────────────────

const VALID_CITIZENSHIP_STATUSES = new Set<CitizenshipStatus>([
  "citizen",
  "qualified_immigrant",
  "undocumented",
  "other",
])

function parseExtractedFacts(raw: string): Partial<ScreenerData> {
  // Strip any markdown fences the model might add despite instructions
  const cleaned = raw
    .replace(/^```(?:json)?/m, "")
    .replace(/```$/m, "")
    .trim()

  // Find the outermost JSON object
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) return {}

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
    const facts: Partial<ScreenerData> = {}

    if (typeof parsed.livesInMA === "boolean") facts.livesInMA = parsed.livesInMA
    if (typeof parsed.age === "number" && parsed.age > 0 && parsed.age < 130) {
      facts.age = Math.round(parsed.age)
    }
    if (typeof parsed.householdSize === "number" && parsed.householdSize >= 1) {
      facts.householdSize = Math.round(parsed.householdSize)
    }
    if (typeof parsed.annualIncome === "number" && parsed.annualIncome >= 0) {
      facts.annualIncome = Math.round(parsed.annualIncome)
    }
    if (typeof parsed.isPregnant === "boolean") facts.isPregnant = parsed.isPregnant
    if (typeof parsed.hasDisability === "boolean") facts.hasDisability = parsed.hasDisability
    if (typeof parsed.hasMedicare === "boolean") facts.hasMedicare = parsed.hasMedicare
    if (typeof parsed.hasEmployerInsurance === "boolean") {
      facts.hasEmployerInsurance = parsed.hasEmployerInsurance
    }
    if (
      typeof parsed.citizenshipStatus === "string" &&
      VALID_CITIZENSHIP_STATUSES.has(parsed.citizenshipStatus as CitizenshipStatus)
    ) {
      facts.citizenshipStatus = parsed.citizenshipStatus as CitizenshipStatus
    }

    return facts
  } catch {
    return {}
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract structured eligibility facts from a conversation using the LLM.
 * Returns a partial ScreenerData object — only fields the user has explicitly stated.
 * Returns {} on any failure (graceful degradation).
 */
export async function extractEligibilityFacts(
  messages: ChatMessage[],
  _language: SupportedLanguage,
): Promise<Partial<ScreenerData>> {
  try {
    const raw = await callOllamaForJson(messages)
    return parseExtractedFacts(raw)
  } catch {
    return {}
  }
}

/**
 * Check whether we have the minimum facts needed to run the eligibility rule engine.
 * Requires: age, householdSize, annualIncome (the three core inputs to runEligibilityCheck).
 * livesInMA defaults to true if not specified (most users of a MA health app are MA residents).
 */
export function isSufficientForEvaluation(facts: Partial<ScreenerData>): boolean {
  return (
    facts.age !== undefined &&
    facts.householdSize !== undefined &&
    facts.annualIncome !== undefined
  )
}

/**
 * Fill in safe defaults for any missing optional ScreenerData fields
 * so runEligibilityCheck can be called with a complete object.
 */
export function applyFactDefaults(facts: Partial<ScreenerData>): ScreenerData {
  return {
    livesInMA:            facts.livesInMA            ?? true,
    age:                  facts.age                  ?? 30,
    householdSize:        facts.householdSize         ?? 1,
    annualIncome:         facts.annualIncome          ?? 0,
    isPregnant:           facts.isPregnant            ?? false,
    hasDisability:        facts.hasDisability         ?? false,
    hasMedicare:          facts.hasMedicare           ?? false,
    hasEmployerInsurance: facts.hasEmployerInsurance  ?? false,
    citizenshipStatus:    facts.citizenshipStatus     ?? "citizen",
  }
}

/**
 * Build a human-readable summary of extracted facts for inclusion in a prompt.
 * Only lists facts that are present (not defaults).
 */
export function summarizeExtractedFacts(facts: Partial<ScreenerData>): string {
  if (Object.keys(facts).length === 0) {
    return "No eligibility facts extracted from conversation yet."
  }

  const lines: string[] = ["Facts gathered so far:"]

  if (facts.livesInMA !== undefined) lines.push(`  - Lives in MA: ${facts.livesInMA ? "Yes" : "No"}`)
  if (facts.age !== undefined) lines.push(`  - Age: ${facts.age}`)
  if (facts.householdSize !== undefined) lines.push(`  - Household size: ${facts.householdSize}`)
  if (facts.annualIncome !== undefined) {
    lines.push(`  - Annual household income: $${facts.annualIncome.toLocaleString()}`)
  }
  if (facts.isPregnant !== undefined) lines.push(`  - Pregnant: ${facts.isPregnant ? "Yes" : "No"}`)
  if (facts.hasDisability !== undefined) lines.push(`  - Has disability/SSI/SSDI: ${facts.hasDisability ? "Yes" : "No"}`)
  if (facts.hasMedicare !== undefined) lines.push(`  - Has Medicare: ${facts.hasMedicare ? "Yes" : "No"}`)
  if (facts.hasEmployerInsurance !== undefined) {
    lines.push(`  - Has employer insurance: ${facts.hasEmployerInsurance ? "Yes" : "No"}`)
  }
  if (facts.citizenshipStatus !== undefined) lines.push(`  - Citizenship: ${facts.citizenshipStatus}`)

  const missing: string[] = []
  if (facts.livesInMA === undefined) missing.push("MA residency")
  if (facts.age === undefined) missing.push("age")
  if (facts.householdSize === undefined) missing.push("household size")
  if (facts.annualIncome === undefined) missing.push("annual income")

  if (missing.length > 0) {
    lines.push(`  Still needed: ${missing.join(", ")}`)
  }

  return lines.join("\n")
}
