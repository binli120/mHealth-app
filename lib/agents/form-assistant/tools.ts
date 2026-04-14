/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tool definitions for the FormAssistantAgent.
 *
 * The LLM drives the conversation — it decides when to extract fields,
 * when to fetch policy context, and when to ask for clarification.
 *
 * Typical ReAct trace:
 *   1. extract_form_fields   → parse what the user has provided so far
 *   2. retrieve_policy       → optional; fetch guidance for policy questions
 *   3. (LLM streams reply asking for the next missing field)
 */

import "server-only"

import { tool } from "ai"
import { z } from "zod"
import type { UIMessageStreamWriter } from "ai"

import { extractFormFields } from "@/lib/masshealth/form-field-extraction"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import type { ChatMessage } from "@/lib/masshealth/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import type { HouseholdMember, IncomeSource } from "@/lib/redux/features/application-slice"
import type { FormSection } from "@/lib/masshealth/form-sections"
import { RAG_TOP_K } from "@/app/api/chat/masshealth/constants"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FormAssistantToolContext {
  messages: ChatMessage[]
  language: SupportedLanguage
  collectedSummary: string
  currentSection: FormSection
  existingMembers: (HouseholdMember & { id: string })[]
  existingSources: (IncomeSource & { id: string })[]
}

// ── Tool factory ──────────────────────────────────────────────────────────────

/**
 * Build tool definitions for the FormAssistantAgent.
 * All extraction context is captured via closure — the LLM calls tools by
 * name/parameters only, never passing raw messages or form state.
 */
export function buildFormAssistantTools(ctx: FormAssistantToolContext, writer: UIMessageStreamWriter) {
  const { messages, language, collectedSummary, currentSection, existingMembers, existingSources } = ctx

  return {
    // ── Tool 1: Extract form fields ───────────────────────────────────────────
    extract_form_fields: tool({
      description:
        "Parse the conversation and extract any form field values the user has provided " +
        "(name, date of birth, address, household members, income sources, etc.). " +
        "Always call this first so you know what has already been collected before asking questions.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await extractFormFields(
          messages,
          collectedSummary,
          currentSection,
          existingMembers,
          existingSources,
          language,
        )

        // Write extracted fields as a data annotation so the form UI can update
        // immediately while the assistant explanation is still streaming.
        writer.write({
          type: "data-masshealth" as `data-${string}`,
          data: {
            ok: true,
            extractedFields: result.fields,
            noHouseholdMembers: result.noHouseholdMembers,
            noIncome: result.noIncome,
            extractionFailed: result.extractionFailed ?? false,
          },
        })

        return {
          extractedFields: result.fields,
          noHouseholdMembers: result.noHouseholdMembers,
          noIncome: result.noIncome,
          extractionFailed: result.extractionFailed ?? false,
          currentSection,
          collectedSummary: collectedSummary || "Nothing collected yet.",
          nextStep: result.extractionFailed
            ? "Extraction failed — ask the user to clarify what they provided."
            : "Extraction succeeded. Guide the user through the next missing field in the current section.",
        }
      },
    }),

    // ── Tool 2: RAG policy retrieval ──────────────────────────────────────────
    retrieve_policy: tool({
      description:
        "Search MassHealth policy documents to answer questions about eligibility rules, " +
        "required documents, or application procedures. Use this when the user asks a policy " +
        "question rather than providing form data.",
      inputSchema: z.object({
        query: z
          .string()
          .max(300)
          .describe("The user's policy question or the topic to look up, e.g. 'citizenship documentation requirements'"),
        topK: z.number().int().min(1).max(6).default(RAG_TOP_K).optional(),
      }),
      execute: async ({ query, topK }) => {
        const chunks = await retrieveRelevantChunks(query, topK ?? RAG_TOP_K).catch(() => [])
        return {
          context: formatChunksForPrompt(chunks) || "No policy documents found for this query.",
          chunkCount: chunks.length,
        }
      },
    }),
  }
}

export type FormAssistantTools = ReturnType<typeof buildFormAssistantTools>
