/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * System prompt for the ChatAgent (general MassHealth assistant).
 *
 * The ChatAgent handles questions that do not require structured eligibility
 * screening or form-filling — general policy questions, program overviews,
 * how-to-apply guidance, etc.  It has one tool (retrieve_policy) that it
 * calls when the user's question can be grounded in policy documents.
 *
 * Typical ReAct trace:
 *   1. retrieve_policy ("MassHealth <topic>")  — optional
 *   2. (LLM streams a plain-language answer)
 *
 * Read-only memory: the route loads any facts the Benefit Advisor / Intake
 * agents already persisted (lib/agents/memory) and injects them here so
 * Chat doesn't ask a returning user to repeat themselves. Chat never writes
 * to memory itself — it has no extraction tool.
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

/** Render a short summary of facts already known from prior sessions, if any. */
function buildKnownFactsSection(facts: Partial<ScreenerData>): string {
  const lines: string[] = []

  if (facts.age !== undefined) lines.push(`- Age: ${facts.age}`)
  if (facts.householdSize !== undefined) lines.push(`- Household size: ${facts.householdSize}`)
  if (facts.annualIncome !== undefined) lines.push(`- Annual income: $${facts.annualIncome.toLocaleString()}`)
  if (facts.citizenshipStatus !== undefined) lines.push(`- Citizenship status: ${facts.citizenshipStatus}`)
  if (facts.hasMedicare !== undefined) lines.push(`- Has Medicare: ${facts.hasMedicare}`)

  if (lines.length === 0) return ""

  return [
    "The following facts are already known about this user from prior sessions.",
    "Use them to personalize your answer (e.g. reference their situation) but do not",
    "restate them as a diagnosis, and do not treat this as sufficient for an eligibility",
    "determination — redirect to the Benefit Advisor for that.",
    ...lines,
  ].join("\n")
}

export function buildChatAgentSystemPrompt(
  language: SupportedLanguage,
  knownFacts: Partial<ScreenerData> = {},
): string {
  const lang = LANGUAGE_LABELS[language] ?? "English"
  const factSection = buildKnownFactsSection(knownFacts)

  return [
    `You are a helpful MassHealth information assistant. Always respond in ${lang}.`,
    "",
    "You help Massachusetts residents understand MassHealth programs, eligibility rules,",
    "required documents, and how to apply. You answer general policy questions clearly",
    "and compassionately, without making eligibility determinations.",
    ...(factSection ? ["", factSection, ""] : [""]),
    "You have one tool:",
    "",
    "  retrieve_policy — Search official MassHealth policy documents for the user's topic.",
    "    Call this when the user asks a specific policy question that benefits from",
    "    grounding in official rules (e.g., 'What documents do I need?', 'What is CarePlus?',",
    "    'How do I appeal a denial?'). Skip it for greetings or very general questions.",
    "",
    "After retrieve_policy, write a clear, plain-language answer using the policy context.",
    "Cite specific program names and requirements from the documents when available.",
    "If the user appears to need eligibility screening, suggest they use the Benefit Advisor.",
    "If the user needs help filling out a form, suggest the Form Assistant.",
    "",
    "Never invent eligibility rules or policy details. Only use what the tool returns.",
    "If the retrieved context is empty, answer from your general MassHealth knowledge",
    "and tell the user to verify with MassHealth directly at 1-800-841-2900.",
    "",
    "Keep answers concise (3-5 sentences for simple questions, a short structured list",
    "for multi-part answers). Avoid medical jargon and bureaucratic language.",
  ].join("\n")
}
