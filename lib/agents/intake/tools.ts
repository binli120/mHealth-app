/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Tool definitions for the IntakeAgent.
 *
 * The intake agent conducts a structured one-question-at-a-time interview
 * to collect all data needed for a MassHealth application.
 *
 * Typical ReAct trace:
 *   1. extract_household_hints    → quickly surface any relationship facts in the
 *                                   user's latest message (no LLM call needed)
 *   2. extract_eligibility_facts  → optional; when the user answers an income,
 *                                   citizenship, pregnancy, disability, Medicare,
 *                                   or employer-insurance question, persist it to
 *                                   user_agent_memory so Chat/Benefit Advisor can
 *                                   reuse it in later sessions
 *   3. (LLM asks the next missing intake question, informed by the hints)
 */

import "server-only"

import { tool } from "ai"
import { z } from "zod"

import { extractHouseholdRelationshipHints } from "@/lib/masshealth/household-relationships"
import { extractEligibilityFacts, summarizeExtractedFacts } from "@/lib/masshealth/fact-extraction"
import { mergeAndSaveAgentMemory } from "@/lib/agents/memory"
import type { ChatMessage } from "@/lib/masshealth/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IntakeToolContext {
  lastUserMessage: string
  messages: ChatMessage[]
  language: SupportedLanguage
  userId: string
}

// ── Tool factory ──────────────────────────────────────────────────────────────

/**
 * Build tool definitions for the IntakeAgent.
 * `context` fields are captured from the route-handler closure.
 */
export function buildIntakeTools(context: IntakeToolContext) {
  const { lastUserMessage, messages, language, userId } = context

  return {
    // ── Tool 1: Household relationship hints (regex — no LLM) ─────────────────
    extract_household_hints: tool({
      description:
        "Extract household relationship hints from the user's latest message using fast pattern " +
        "matching (no LLM call). Returns any mentioned relationships (spouse, child, parent, etc.) " +
        "and associated names. Use this to avoid asking the user for information they already stated. " +
        "Call this at the start of each turn that involves household members.",
      inputSchema: z.object({}),
      execute: async () => {
        const hints = extractHouseholdRelationshipHints(lastUserMessage)
        if (hints.length === 0) {
          return {
            hints: [],
            summary: "No household relationship mentions detected in the latest message.",
          }
        }

        const lines = hints.map((h) =>
          h.memberName
            ? `${h.memberName} is the applicant's ${h.relationship}`
            : `The applicant mentioned a ${h.relationship}`,
        )

        return {
          hints,
          summary: lines.join("; "),
          instruction:
            "Do not ask for these relationships again. Use the names and relationships already stated.",
        }
      },
    }),

    // ── Tool 2: Eligibility fact extraction → cross-session memory ────────────
    extract_eligibility_facts: tool({
      description:
        "Extract structured eligibility facts (age, household size, income, citizenship status, " +
        "pregnancy, disability, Medicare, employer insurance) from the conversation so far and " +
        "persist them for future sessions. Call this after the user answers a question in the " +
        "Income or Special circumstances section — not for name/contact/address questions.",
      inputSchema: z.object({}),
      execute: async () => {
        const extractedFacts = await extractEligibilityFacts(messages, language)

        // Fire-and-forget, same as the Benefit Advisor's extraction tool — DB
        // latency never blocks the streaming interview response.
        if (Object.keys(extractedFacts).length > 0) {
          mergeAndSaveAgentMemory(userId, { extractedFacts }).catch(() => {})
        }

        return {
          facts: extractedFacts,
          summary: summarizeExtractedFacts(extractedFacts),
        }
      },
    }),
  }
}

export type IntakeTools = ReturnType<typeof buildIntakeTools>
