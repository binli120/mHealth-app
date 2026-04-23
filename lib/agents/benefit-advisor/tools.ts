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
import { evaluateBenefitStack } from "@/lib/benefit-orchestration/orchestrator"
import { screenerToFamilyProfile } from "@/lib/benefit-orchestration/from-screener"
import { runBenefitOrchestrator } from "@/lib/agents/benefit-orchestrator"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import { buildRagQualityMetadata } from "@/lib/rag/metadata"
import { mergeAndSaveAgentMemory } from "@/lib/agents/memory"
import type { ChatMessage } from "@/lib/masshealth/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { RAG_TOP_K_ADVISOR } from "@/app/api/chat/masshealth/constants"
import type { ScreenerData } from "@/lib/eligibility-engine"
import { reviewEligibilityExplanationQuality } from "@/lib/agents/reflection/quality-gate"
import { incrementCounter } from "@/lib/server/counters"

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

function formatEligibilityContext(
  facts: Partial<ScreenerData>,
  report: ReturnType<typeof runEligibilityCheck>,
): string {
  return JSON.stringify(
    {
      facts,
      fplPercent: report.fplPercent,
      annualFPL: report.annualFPL,
      summary: report.summary,
      results: report.results.map((r) => ({
        program: r.program,
        status: r.status,
        tagline: r.tagline,
      })),
    },
    null,
    2,
  )
}

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
  let latestEligibilityContext = ""
  let latestPolicyContext = ""

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

    // ── Tool 2: Run full benefit stack evaluation ─────────────────────────────
    check_eligibility: tool({
      description:
        "Run the full MA safety-net benefit evaluation across all programs " +
        "(MassHealth, SNAP, WIC, EITC, Section 8, LIHEAP, childcare, cash assistance) " +
        "and get a ranked benefit stack. " +
        "Only call this AFTER extract_eligibility_facts returns sufficient=true. " +
        "Pass the facts object returned by extract_eligibility_facts.",
      inputSchema: partialScreenerSchema,
      execute: async (facts) => {
        const screenerData = applyFactDefaults(facts)

        // Run the full cross-program orchestrator (superset of the quick screener).
        const familyProfile = screenerToFamilyProfile(screenerData)
        const stack = evaluateBenefitStack(familyProfile)

        // Also run the quick screener so the frontend can render legacy badges.
        const report = runEligibilityCheck(screenerData)
        latestEligibilityContext = formatEligibilityContext(facts, report)

        // Emit both the legacy screener results and the new full benefit stack
        // so the frontend can progressively upgrade its UI without a breaking change.
        writer.write({
          type: "data-masshealth" as `data-${string}`,
          data: {
            ok: true,
            outOfScope: false,
            factsExtracted: facts,
            // Legacy screener view — for existing badge components.
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
            // Full benefit stack — richer data for the new benefit stack UI.
            benefitStack: {
              fplPercent: stack.fplPercent,
              annualFPL: stack.annualFPL,
              totalMonthlyIncome: stack.totalMonthlyIncome,
              householdSize: stack.householdSize,
              summary: stack.summary,
              totalEstimatedMonthlyValue: stack.totalEstimatedMonthlyValue,
              totalEstimatedAnnualValue: stack.totalEstimatedAnnualValue,
              quickWins: stack.quickWins.map((r) => ({
                programId: r.programId,
                programName: r.programName,
                category: r.category,
                eligibilityStatus: r.eligibilityStatus,
                confidence: r.confidence,
                estimatedMonthlyValue: r.estimatedMonthlyValue,
                valueNote: r.valueNote,
                nextSteps: r.nextSteps,
              })),
              results: stack.results.map((r) => ({
                programId: r.programId,
                programName: r.programName,
                programShortName: r.programShortName,
                category: r.category,
                eligibilityStatus: r.eligibilityStatus,
                confidence: r.confidence,
                estimatedMonthlyValue: r.estimatedMonthlyValue,
                estimatedAnnualValue: r.estimatedAnnualValue,
                valueNote: r.valueNote,
                priority: r.priority,
                keyRequirements: r.keyRequirements,
                nextSteps: r.nextSteps,
                applicationUrl: r.applicationUrl,
                applicationPhone: r.applicationPhone,
                bundleWith: r.bundleWith,
              })),
              bundles: stack.bundles,
            },
          },
        })

        const topResults = stack.results.slice(0, 5)
        return {
          fplPercent: stack.fplPercent,
          summary: stack.summary,
          totalEstimatedMonthlyValue: stack.totalEstimatedMonthlyValue,
          likelyCount: stack.likelyPrograms.length,
          possibleCount: stack.possiblePrograms.length,
          topPrograms: topResults.map((r) => ({
            programName: r.programName,
            category: r.category,
            status: r.eligibilityStatus,
            estimatedMonthlyValue: r.estimatedMonthlyValue,
            valueNote: r.valueNote,
          })),
          bundles: stack.bundles.map((b) => b.bundleName),
          nextStep:
            `Call retrieve_policy with a query about the top programs: ` +
            topResults
              .slice(0, 2)
              .map((r) => r.programName)
              .join(", "),
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
        const requestedTopK = topK ?? RAG_TOP_K_ADVISOR
        const chunks = await retrieveRelevantChunks(query, requestedTopK).catch(() => [])
        latestPolicyContext = formatChunksForPrompt(chunks)
        const rag = buildRagQualityMetadata(query, chunks, requestedTopK)

        // Warn when grounding is absent or weak so the LLM self-limits its claims.
        const isLowConfidence = rag.confidence === "none" || rag.confidence === "low"
        if (isLowConfidence) {
          incrementCounter("rag_low_confidence_used", { agent: "benefit-advisor" })
        }

        writer.write({
          type: "data-masshealth" as `data-${string}`,
          data: {
            ok: true,
            outOfScope: false,
            rag,
          },
        })

        return {
          context: latestPolicyContext || "No policy documents found for this query.",
          chunkCount: chunks.length,
          rag,
          ...(isLowConfidence && {
            groundingWarning:
              "Policy context is absent or low-confidence. Do not assert specific income limits, " +
              "program names, or eligibility rules without qualifying them as approximate. " +
              "Recommend the user verify at mass.gov or by calling 1-800-841-2900.",
          }),
        }
      },
    }),

    // ── Tool 4: Full multi-agent benefit stack ────────────────────────────────
    run_benefit_orchestrator: tool({
      description:
        "Run the full multi-agent benefit stack evaluation using all 7 specialist agents in parallel. " +
        "Each specialist (MassHealth, Food & Nutrition, Cash Assistance, Tax Credits, Housing, " +
        "Utility, Childcare) evaluates its programs and returns reasoning about edge cases. " +
        "Use this INSTEAD OF check_eligibility when the conversation has revealed richer household " +
        "details (children's ages, income breakdown, asset details, housing situation, utility types). " +
        "It produces specialist reasoning you can quote when explaining results to the user.",
      inputSchema: partialScreenerSchema,
      execute: async (facts) => {
        const screenerData = applyFactDefaults(facts)
        const familyProfile = screenerToFamilyProfile(screenerData)

        const agentStack = await runBenefitOrchestrator(familyProfile)

        writer.write({
          type: "data-masshealth" as `data-${string}`,
          data: {
            ok: true,
            outOfScope: false,
            factsExtracted: facts,
            benefitStack: {
              fplPercent: agentStack.fplPercent,
              annualFPL: agentStack.annualFPL,
              totalMonthlyIncome: agentStack.totalMonthlyIncome,
              householdSize: agentStack.householdSize,
              summary: agentStack.summary,
              totalEstimatedMonthlyValue: agentStack.totalEstimatedMonthlyValue,
              totalEstimatedAnnualValue: agentStack.totalEstimatedAnnualValue,
              quickWins: agentStack.quickWins.map((r) => ({
                programId: r.programId,
                programName: r.programName,
                category: r.category,
                eligibilityStatus: r.eligibilityStatus,
                confidence: r.confidence,
                estimatedMonthlyValue: r.estimatedMonthlyValue,
                valueNote: r.valueNote,
                nextSteps: r.nextSteps,
              })),
              results: agentStack.results.map((r) => ({
                programId: r.programId,
                programName: r.programName,
                programShortName: r.programShortName,
                category: r.category,
                eligibilityStatus: r.eligibilityStatus,
                confidence: r.confidence,
                estimatedMonthlyValue: r.estimatedMonthlyValue,
                estimatedAnnualValue: r.estimatedAnnualValue,
                valueNote: r.valueNote,
                priority: r.priority,
                keyRequirements: r.keyRequirements,
                nextSteps: r.nextSteps,
                applicationUrl: r.applicationUrl,
                applicationPhone: r.applicationPhone,
                bundleWith: r.bundleWith,
              })),
              bundles: agentStack.bundles,
              specialistReasoning: agentStack.specialistReasoning,
            },
          },
        })

        return {
          fplPercent: agentStack.fplPercent,
          summary: agentStack.summary,
          totalEstimatedMonthlyValue: agentStack.totalEstimatedMonthlyValue,
          likelyCount: agentStack.likelyPrograms.length,
          possibleCount: agentStack.possiblePrograms.length,
          topPrograms: agentStack.results.slice(0, 5).map((r) => ({
            programName: r.programName,
            category: r.category,
            status: r.eligibilityStatus,
            estimatedMonthlyValue: r.estimatedMonthlyValue,
            valueNote: r.valueNote,
          })),
          specialistReasoning: agentStack.specialistReasoning,
          bundles: agentStack.bundles.map((b) => b.bundleName),
          nextStep:
            "Call retrieve_policy for the top programs, then finish_eligibility_explanation. " +
            "You may quote specialistReasoning fields verbatim when explaining edge cases.",
        }
      },
    }),

    // ── Tool 5: Review and commit final explanation ──────────────────────────
    finish_eligibility_explanation: tool({
      description:
        "Submit the final MassHealth eligibility explanation for a reflection quality review before it reaches the user. " +
        "Call this only AFTER check_eligibility and retrieve_policy. The tool returns the reviewed explanation.",
      inputSchema: z.object({
        explanation: z
          .string()
          .min(1)
          .max(4000)
          .describe("The complete plain-language eligibility explanation drafted from the eligibility and policy tool results."),
      }),
      execute: async ({ explanation }) => {
        const qualityGate = await reviewEligibilityExplanationQuality({
          explanation,
          eligibilityContext: latestEligibilityContext,
          policyContext: latestPolicyContext,
          language,
        })

        writer.write({
          type: "data-masshealth" as `data-${string}`,
          data: {
            ok: true,
            outOfScope: false,
            eligibilityExplanation: qualityGate.finalText,
            reflection: qualityGate.review,
          },
        })

        return {
          committed: true,
          finalExplanation: qualityGate.finalText,
          reflection: qualityGate.review,
          nextStep:
            "Stream finalExplanation exactly as returned by this tool. Do not add new eligibility claims.",
        }
      },
    }),
  }
}

export type BenefitAdvisorTools = ReturnType<typeof buildBenefitAdvisorTools>
