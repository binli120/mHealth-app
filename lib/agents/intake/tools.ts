/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tool definitions for the IntakeAgent.
 *
 * The intake agent conducts a structured one-question-at-a-time interview
 * to collect all data needed for a MassHealth application.  Its primary tool
 * is relationship-hint extraction — a fast, regex-based pass that surfaces
 * household relationship facts the LLM can use to avoid asking redundant
 * questions.
 *
 * Typical ReAct trace:
 *   1. extract_household_hints  → quickly surface any relationship facts in the
 *                                 user's latest message (no LLM call needed)
 *   2. (LLM asks the next missing intake question, informed by the hints)
 */

import "server-only"

import { tool } from "ai"
import { z } from "zod"

import { extractHouseholdRelationshipHints } from "@/lib/masshealth/household-relationships"

// ── Tool factory ──────────────────────────────────────────────────────────────

/**
 * Build tool definitions for the IntakeAgent.
 * `lastUserMessage` is captured from the route-handler closure.
 */
export function buildIntakeTools(lastUserMessage: string) {
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
  }
}

export type IntakeTools = ReturnType<typeof buildIntakeTools>
