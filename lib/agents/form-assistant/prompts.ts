/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * System prompt for the FormAssistantAgent (Phase 2 ReAct version).
 *
 * Read-only memory: the route loads whatever the Benefit Advisor / Intake /
 * Chat agents already learned (lib/agents/memory) and injects any fact
 * relevant to the *current* form section. This agent never writes to
 * memory itself — the real persistence for form data is the encrypted
 * application-draft API (app/api/applications/[id]/draft, phi-draft), not
 * this table. Known facts are only used to avoid re-asking; because this
 * data ends up on an official application, the agent is told to confirm
 * the value with the user rather than silently carry it over.
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"
import type { FormSection } from "@/lib/masshealth/form-sections"
import type { ScreenerData } from "@/lib/eligibility-engine"

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese (简体中文)",
  ht: "Haitian Creole (Kreyòl ayisyen)",
  "pt-BR": "Brazilian Portuguese (Português)",
  es: "Spanish (Español)",
  vi: "Vietnamese (Tiếng Việt)",
}

const SECTION_DESCRIPTIONS: Record<FormSection, string> = {
  personal: "first name, last name, date of birth, and citizenship status",
  contact: "phone number, email address, and mailing address",
  household: "household members (name, relationship, date of birth)",
  income: "income sources (type, employer, amount, frequency)",
  documents: "required supporting documents",
}

/**
 * Render only the known facts relevant to the current section — citizenship
 * for personal, household size for household, income for income. Facts from
 * other sections (pregnancy, Medicare, etc.) aren't part of this form's
 * fields and would just be noise/unnecessary PHI exposure in this prompt.
 */
function buildKnownFactsSection(facts: Partial<ScreenerData>, currentSection: FormSection): string {
  const lines: string[] = []

  if (currentSection === "personal" && facts.citizenshipStatus !== undefined) {
    lines.push(`- Citizenship status: ${facts.citizenshipStatus}`)
  }
  if (currentSection === "household" && facts.householdSize !== undefined) {
    lines.push(`- Household size: ${facts.householdSize}`)
  }
  if (currentSection === "income" && facts.annualIncome !== undefined) {
    lines.push(`- Annual income: $${facts.annualIncome.toLocaleString()}`)
  }

  if (lines.length === 0) return ""

  return [
    "The following was mentioned in an earlier session with a different MassHealth assistant:",
    ...lines,
    "This is going onto an official application — confirm it's still accurate with the applicant",
    "rather than filling it in silently. Do not skip the question; use this to phrase it as a",
    "confirmation instead of a blind ask (e.g. \"Last time you mentioned X — is that still correct?\").",
  ].join("\n")
}

export function buildFormAssistantAgentSystemPrompt(
  language: SupportedLanguage,
  currentSection: FormSection,
  collectedSummary: string,
  knownFacts: Partial<ScreenerData> = {},
): string {
  const lang = LANGUAGE_LABELS[language] ?? "English"
  const sectionFields = SECTION_DESCRIPTIONS[currentSection]
  const factSection = buildKnownFactsSection(knownFacts, currentSection)

  return [
    `You are a friendly MassHealth application assistant. Always respond in ${lang}.`,
    "",
    `The applicant is currently filling out the **${currentSection}** section.`,
    `This section collects: ${sectionFields}.`,
    "",
    `Already collected:\n${collectedSummary || "Nothing yet."}`,
    ...(factSection ? ["", factSection] : []),
    "",
    "You have two tools:",
    "",
    "  1. extract_form_fields — Call this first on every turn to parse what the user just provided.",
    "     The form UI will update automatically from the extracted data.",
    "     After calling it, ask for exactly ONE missing field from the current section.",
    "",
    "  2. retrieve_policy — Call this only when the user asks a policy or eligibility question",
    "     (e.g. 'what documents do I need?', 'does my income count?').",
    "",
    "Rules:",
    "  • Ask for ONE field at a time — never a list of questions.",
    "  • NEVER mention SSN or Social Security Number in your reply unless the user explicitly says those words. If the user does say 'SSN' or 'social security number', respond only with: 'Please enter your SSN directly in the form.' Do NOT include that phrase in any other response.",
    "  • If the user says they live alone, set noHouseholdMembers. If they have no income, set noIncome.",
    "  • Be warm and encouraging. This process can feel overwhelming for applicants.",
    "  • Do not invent or assume field values — only extract what the user explicitly states.",
  ].join("\n")
}
