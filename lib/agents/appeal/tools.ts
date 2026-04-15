/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tool definitions for the AppealAgent.
 *
 * The appeal agent generates MassHealth appeal letters with supporting
 * evidence checklists.  Two tools give the LLM the information it needs:
 *
 *   1. retrieve_policy   → fetch relevant MassHealth policy and appeal procedures
 *   2. finish_appeal     → commit the structured output (letter + checklist)
 *
 * Typical ReAct trace:
 *   1. LLM calls retrieve_policy("MassHealth <denial reason> appeal procedures")
 *   2. LLM calls finish_appeal({ explanation, appealLetter, evidenceChecklist })
 *      → structured data written as data-masshealth annotation
 *   3. LLM streams a short human-friendly summary of what to do next
 */

import "server-only"

import { tool } from "ai"
import { z } from "zod"
import type { UIMessageStreamWriter } from "ai"

import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import { buildRagQualityMetadata } from "@/lib/rag/metadata"
import { APPEAL_RAG_TOP_K } from "@/lib/appeals/constants"
import { reviewAppealLetterQuality } from "@/lib/agents/reflection/quality-gate"
import { incrementCounter } from "@/lib/server/counters"

// ── Tool factory ──────────────────────────────────────────────────────────────

/**
 * Build tool definitions for the AppealAgent.
 * `writer` is captured from the route-handler closure so `finish_appeal`
 * can write the structured annotation directly into the response stream.
 */
export function buildAppealTools(writer: UIMessageStreamWriter) {
  let latestPolicyContext = ""

  return {
    // ── Tool 1: RAG policy retrieval ──────────────────────────────────────────
    retrieve_policy: tool({
      description:
        "Search MassHealth policy documents and appeal procedures relevant to a denial reason. " +
        "Always call this first to ground your appeal in accurate policy language before drafting the letter.",
      inputSchema: z.object({
        query: z
          .string()
          .max(300)
          .describe(
            "Search query combining the denial reason and 'appeal', " +
            "e.g. 'MassHealth income exceeds limit appeal procedures' or " +
            "'MassHealth residency verification appeal rights'",
          ),
        topK: z.number().int().min(1).max(8).default(APPEAL_RAG_TOP_K).optional(),
      }),
      execute: async ({ query, topK }) => {
        const requestedTopK = topK ?? APPEAL_RAG_TOP_K
        const chunks = await retrieveRelevantChunks(query, requestedTopK).catch(() => [])
        latestPolicyContext = formatChunksForPrompt(chunks)
        const rag = buildRagQualityMetadata(query, chunks, requestedTopK)

        const isLowConfidence = rag.confidence === "none" || rag.confidence === "low"
        if (isLowConfidence) {
          incrementCounter("rag_low_confidence_used", { agent: "appeal" })
        }

        writer.write({
          type: "data-masshealth" as `data-${string}`,
          data: {
            ok: true,
            rag,
          },
        })

        return {
          context: latestPolicyContext || "No policy documents found — use general MassHealth appeal principles.",
          chunkCount: chunks.length,
          rag,
          ...(isLowConfidence && {
            groundingWarning:
              "Policy context is absent or low-confidence. Draft the appeal letter from general MassHealth " +
              "appeal principles only. Do not cite specific regulation numbers or policy rules you cannot verify. " +
              "Recommend the user confirm details at mass.gov/masshealth or by calling 1-800-841-2900.",
          }),
        }
      },
    }),

    // ── Tool 2: Commit structured appeal output ────────────────────────────────
    finish_appeal: tool({
      description:
        "Commit the completed appeal analysis — explanation, formal appeal letter, and evidence checklist. " +
        "Call this AFTER retrieve_policy once you have drafted all three components. " +
        "This writes the structured output to the client so the user can download or copy their letter.",
      inputSchema: z.object({
        explanation: z
          .string()
          .describe(
            "Plain-language explanation (2-4 sentences) of why the denial may be incorrect " +
            "and the strongest grounds for appeal.",
          ),
        appealLetter: z
          .string()
          .describe(
            "Full formal appeal letter addressed to MassHealth. Include: date placeholder, " +
            "applicant's name placeholder, case number placeholder, denial reason, legal grounds, " +
            "and a polite but firm request for reconsideration.",
          ),
        evidenceChecklist: z
          .array(z.string())
          .min(1)
          .max(10)
          .describe("List of specific documents or evidence the applicant should gather to support their appeal."),
      }),
      execute: async ({ explanation, appealLetter, evidenceChecklist }) => {
        const qualityGate = await reviewAppealLetterQuality({
          appealLetter,
          explanation,
          evidenceChecklist,
          policyContext: latestPolicyContext,
        })

        // Write the structured appeal data as a annotation so the frontend
        // can render the appeal letter and checklist while the summary streams.
        writer.write({
          type: "data-masshealth" as `data-${string}`,
          data: {
            ok: true,
            analysis: { explanation, appealLetter: qualityGate.finalText, evidenceChecklist },
            reflection: qualityGate.review,
          },
        })

        return {
          committed: true,
          reflection: qualityGate.review,
          nextStep:
            "The reviewed appeal letter has been delivered to the client. " +
            "Stream a brief, encouraging summary of the next steps the applicant should take.",
        }
      },
    }),
  }
}

export type AppealTools = ReturnType<typeof buildAppealTools>
