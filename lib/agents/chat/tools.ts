/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Tool definitions for the ChatAgent (general MassHealth assistant).
 *
 * The ChatAgent answers general policy questions. Its only tool is
 * retrieve_policy — used to ground answers in official MassHealth documents
 * without performing eligibility screening or form extraction.
 *
 * Typical ReAct trace:
 *   1. retrieve_policy ("MassHealth <topic>")  — optional
 *   2. (LLM streams a plain-language answer grounded in policy context)
 */

import "server-only"

import { tool } from "ai"
import { z } from "zod"

import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import { RAG_TOP_K } from "@/app/api/chat/masshealth/constants"

// ── Tool factory ──────────────────────────────────────────────────────────────

/**
 * Build tool definitions for the ChatAgent.
 * No closure state needed — the tool is stateless; the LLM supplies the query.
 */
export function buildChatTools() {
  return {
    // ── Tool 1: RAG policy retrieval ──────────────────────────────────────────
    retrieve_policy: tool({
      description:
        "Search official MassHealth policy documents to answer the user's question. " +
        "Use this when the user asks about eligibility rules, program benefits, required " +
        "documents, application procedures, or appeal rights. Skip for greetings or vague " +
        "questions where policy lookup adds no value.",
      inputSchema: z.object({
        query: z
          .string()
          .max(300)
          .describe(
            "The user's question or relevant topic to search, " +
            "e.g. 'MassHealth CarePlus income limits' or 'citizenship documentation requirements'",
          ),
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

export type ChatTools = ReturnType<typeof buildChatTools>
