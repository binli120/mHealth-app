/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * System prompt for the BenefitAdvisorAgent (Phase 2 ReAct version).
 *
 * This prompt is intentionally slim — it describes the agent's role and
 * tool-calling sequence.  Policy context and eligibility data are injected
 * at run time by the tools, not hard-wired into the prompt.
 *
 * Phase 4: knownFacts (from persistent memory) are injected at the top of the
 * prompt so the agent skips questions it already knows the answers to.
 */

import type { SupportedLanguage } from "@/lib/i18n/languages"
import type { ScreenerData } from "@/lib/eligibility-engine"

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese (简体中文)",
  ht: "Haitian Creole (Kreyòl ayisyen)",
  "pt-BR": "Brazilian Portuguese (Português)",
  es: "Spanish (Español)",
  vi: "Vietnamese (Tiếng Việt)",
}

// ── Known-facts section ───────────────────────────────────────────────────────

/**
 * Render a human-readable block of facts already known from prior sessions.
 * Returns an empty string when no facts are available (first session).
 */
function buildKnownFactsSection(facts: Partial<ScreenerData>): string {
  const lines: string[] = []

  if (facts.age !== undefined) lines.push(`- Age: ${facts.age}`)
  if (facts.householdSize !== undefined) lines.push(`- Household size: ${facts.householdSize}`)
  if (facts.annualIncome !== undefined) lines.push(`- Annual income: $${facts.annualIncome.toLocaleString()}`)
  if (facts.citizenshipStatus !== undefined) lines.push(`- Citizenship status: ${facts.citizenshipStatus}`)
  if (facts.isPregnant !== undefined) lines.push(`- Pregnant: ${facts.isPregnant}`)
  if (facts.hasDisability !== undefined) lines.push(`- Has documented disability/SSI/SSDI: ${facts.hasDisability}`)
  if (facts.hasMedicare !== undefined) lines.push(`- Has Medicare: ${facts.hasMedicare}`)
  if (facts.hasEmployerInsurance !== undefined) lines.push(`- Has employer insurance: ${facts.hasEmployerInsurance}`)
  if (facts.livesInMA !== undefined) lines.push(`- Lives in Massachusetts: ${facts.livesInMA}`)

  if (lines.length === 0) return ""

  return [
    "The following facts are already known from this user's prior sessions.",
    "Do NOT ask for information that is already listed here.",
    ...lines,
  ].join("\n")
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the system prompt for the BenefitAdvisorAgent.
 *
 * @param language   Response language (defaults to English).
 * @param knownFacts Facts already persisted from prior sessions (Phase 4).
 *                   When non-empty, the agent skips questions it already knows.
 */
export function buildBenefitAdvisorAgentSystemPrompt(
  language: SupportedLanguage,
  knownFacts: Partial<ScreenerData> = {},
): string {
  const lang = LANGUAGE_LABELS[language] ?? "English"
  const factSection = buildKnownFactsSection(knownFacts)

  return [
    `You are a compassionate MassHealth benefit advisor. Always respond in ${lang}.`,
    "",
    "You help Massachusetts residents understand which health coverage programs they qualify for.",
    ...(factSection ? ["", factSection, ""] : [""]),
    "You have three tools. Use them in this order:",
    "",
    "  1. extract_eligibility_facts — Always call this first to see what the user has shared.",
    "     • If sufficient=true → proceed to step 2.",
    "     • If sufficient=false → ask the user ONE specific missing question, then stop.",
    "",
    "  2. check_eligibility — Call with the facts from step 1 when sufficient=true.",
    "     This runs the rule engine and tells you which programs the user likely qualifies for.",
    "",
    "  3. retrieve_policy — Call with the top program names as the query to get accurate",
    "     policy details to ground your explanation.",
    "",
    "After the tools complete, write a warm, plain-language explanation of the results.",
    "Avoid jargon. Use concrete numbers (income limits, % FPL) from the policy context.",
    "If a program is 'likely', explain what they need to do to apply.",
    "If a program is 'unlikely', briefly explain why and suggest alternatives.",
    "",
    "Never invent eligibility rules. Only cite what the tools return.",
    "If the user asks about something unrelated to MassHealth or MA health benefits, politely redirect.",
  ].join("\n")
}
