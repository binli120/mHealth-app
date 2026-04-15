/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tool definitions for the BenefitAdvisorAgent.
 *
 * In Phase 2 the LLM drives its own reasoning chain — it decides which tools
 * to call and in what order.  TypeScript no longer hard-wires the sequence.
 *
 * Typical ReAct trace:
 *   1. extract_eligibility_facts  → discover what the user has shared
 *   2. check_eligibility          → run rule engine (only when facts are sufficient)
 *   3. retrieve_policy            → ground explanation in official policy text
 *   4. (LLM streams final reply)
 *
 * Phase 4: extract_eligibility_facts now persists extracted facts to
 * user_agent_memory (fire-and-forget) so they are available across sessions.
 */

import "server-only"

import { tool } from "ai"
import { z } from "zod"
import type { UIMessageStreamWriter } from "ai"

import {
  extractEligibilityFacts,
  applyFactDefaults,
  isSufficientForEvaluation,
  summarizeExtractedFacts,
} from "@/lib/masshealth/fact-extraction"
import { runEligibilityCheck } from "@/lib/eligibility-engine"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import { mergeAndSaveAgentMemory } from "@/lib/agents/memory"
import type { ChatMessage } from "@/lib/masshealth/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { RAG_TOP_K_ADVISOR } from "@/app/api/chat/masshealth/constants"
import type { ScreenerData } from "@/lib/eligibility-engine"

// ── Zod schema for partial screener data ──────────────────────────────────────

/**
 * All fields optional because the LLM calls check_eligibility with whatever
 * facts it received from extract_eligibility_facts. applyFactDefaults() fills
 * the remaining fields before handing off to runEligibilityCheck().
 */
const partialScreenerSchema = z.object({
  livesInMA: z.boolean().optional().describe("True if the user lives in Massachusetts"),
  age: z.number().int().min(0).max(130).optional().describe("Applicant age in years"),
  householdSize: z.number().int().min(1).max(20).optional().describe("Total people in household including applicant"),
  annualIncome: z.number().min(0).optional().describe("Total household annual income in USD"),
  isPregnant: z.boolean().optional(),
  hasDisability: z.boolean().optional().describe("True if applicant has documented disability or receives SSI/SSDI"),
  hasMedicare: z.boolean().optional(),
  hasEmployerInsurance: z.boolean().optional(),
  citizenshipStatus: z.enum(["citizen", "qualified_immigrant", "undocumented", "other"]).optional(),
})

// ── Tool factory ──────────────────────────────────────────────────────────────

/**
 * Build tool definitions for the BenefitAdvisorAgent.
 *
 * `messages`, `language`, `writer`, and `userId` are captured from the
 * route-handler closure so the LLM never has to pass raw message arrays as
 * tool arguments.  `userId` enables Phase 4 memory persistence — extracted
 * facts are saved after each extraction step.
 */
export function buildBenefitAdvisorTools(
  messages: ChatMessage[],
  language: SupportedLanguage,
  writer: UIMessageStreamWriter,
  userId: string,
  knownFacts: Partial<ScreenerData> = {},
) {
  return {
    // ── Tool 1: Extract eligibility facts ─────────────────────────────────────
    extract_eligibility_facts: tool({
      description:
        "Extract structured eligibility facts (age, income, household size, citizenship status, " +
        "disability, pregnancy, Medicare, employer insurance) from the conversation history. " +
        "Always call this first before deciding whether to run the eligibility engine.",
      inputSchema: z.object({}),
      execute: async () => {
        const extractedFacts = await extractEligibilityFacts(messages, language)
        const facts = { ...knownFacts, ...extractedFacts }

        // Phase 4: persist extracted facts — fire-and-forget so DB latency
        // never blocks the streaming response.
        mergeAndSaveAgentMemory(userId, { extractedFacts }).catch(() => {})

        const sufficient = isSufficientForEvaluation(facts)
        return {
          facts,
          sufficient,
          summary: summarizeExtractedFacts(facts),
          nextStep: sufficient
            ? "Facts are sufficient. Call check_eligibility with these facts."
            : "Critical facts missing. Ask the user ONE specific question to fill a gap, then stop.",
        }
      },
    }),

    // ── Tool 2: Run eligibility rule engine ───────────────────────────────────
    check_eligibility: tool({
      description:
        "Run the MassHealth deterministic eligibility rule engine and get program recommendations. " +
        "Only call this AFTER extract_eligibility_facts returns sufficient=true. " +
        "Pass the facts object returned by extract_eligibility_facts.",
      inputSchema: partialScreenerSchema,
      execute: async (facts) => {
        const screenerData = applyFactDefaults(facts)
        const report = runEligibilityCheck(screenerData)

        // Write the structured eligibility result as a data annotation so the
        // frontend can render eligibility badges while the text is still streaming.
        writer.write({
          type: "data-masshealth" as `data-${string}`,
          data: {
            ok: true,
            outOfScope: false,
            factsExtracted: facts,
            eligibilityResults: {
              fplPercent: report.fplPercent,
              annualFPL: report.annualFPL,
              summary: report.summary,
              results: report.results.map((r) => ({
                program: r.program,
                status: r.status,
                tagline: r.tagline,
                actionLabel: r.actionLabel,
                actionHref: r.actionHref,
                color: r.color,
              })),
            },
          },
        })

        return {
          fplPercent: report.fplPercent,
          summary: report.summary,
          topPrograms: report.results.slice(0, 3).map((r) => r.program),
          allResults: report.results.map((r) => ({
            program: r.program,
            status: r.status,
            tagline: r.tagline,
          })),
          nextStep: `Call retrieve_policy with a query about the top programs: ${report.results.slice(0, 2).map((r) => r.program).join(", ")}`,
        }
      },
    }),

    // ── Tool 3: RAG policy retrieval ──────────────────────────────────────────
    retrieve_policy: tool({
      description:
        "Search MassHealth policy documents for accurate, up-to-date information about a specific " +
        "program, income limit, eligibility rule, or application process. " +
        "Use the top program names from check_eligibility as your query for best results.",
      inputSchema: z.object({
        query: z
          .string()
          .max(300)
          .describe("Search query, e.g. 'MassHealth CarePlus income limits 2026' or 'SNAP food stamps eligibility'"),
        topK: z.number().int().min(1).max(8).default(RAG_TOP_K_ADVISOR).optional(),
      }),
      execute: async ({ query, topK }) => {
        const chunks = await retrieveRelevantChunks(query, topK ?? RAG_TOP_K_ADVISOR).catch(() => [])
        const context = formatChunksForPrompt(chunks)
        return {
          context: context || "No policy documents found for this query.",
          chunkCount: chunks.length,
        }
      },
    }),
  }
}

export type BenefitAdvisorTools = ReturnType<typeof buildBenefitAdvisorTools>
