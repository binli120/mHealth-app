/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { generateText } from "ai"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import { logServerError, logServerWarn } from "@/lib/server/logger"
import { buildAppealSystemPrompt } from "@/lib/appeals/prompts"
import { reviewAppealLetterQuality } from "@/lib/agents/reflection/quality-gate"
import { computeInputHash, getCachedAppealAnalysis, saveAppealAnalysis } from "@/lib/appeals/cache"
import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import {
  APPEAL_DENIAL_REASONS,
  APPEAL_DENIAL_REASON_IDS,
  APPEAL_DETAILS_MAX_LENGTH,
  APPEAL_RAG_TOP_K,
  APPEAL_ANALYZE_MAX_OUTPUT_TOKENS,
  APPEAL_ANALYZE_TIMEOUT_MS,
  ERROR_APPEAL_INVALID_PAYLOAD,
  ERROR_APPEAL_OLLAMA_FAILED,
  ERROR_APPEAL_LOG_PREFIX,
} from "@/lib/appeals/constants"
import type { AppealAnalysis } from "@/lib/appeals/types"
import { OLLAMA_TEMPERATURE } from "@/app/api/chat/masshealth/constants"

export const runtime = "nodejs"

const requestSchema = z.object({
  denialReasonId: z.enum(APPEAL_DENIAL_REASON_IDS),
  denialDetails: z.string().trim().max(APPEAL_DETAILS_MAX_LENGTH).default(""),
  documentText: z.string().trim().max(8000).optional(),
})

/**
 * Extracts the outermost JSON object from `text`, tolerating any prose the
 * model may have written before or after the JSON block.
 */
function extractJsonBlock(text: string): string {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start !== -1 && end > start) return text.slice(start, end + 1)
  return text
}

function parseAppealAnalysis(raw: string): AppealAnalysis | null {
  // 1. Strip markdown fences if the model wrapped the JSON.
  // 2. Extract the outermost { … } so any prose before/after is ignored.
  const cleaned = extractJsonBlock(
    raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim(),
  )

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation : ""
    const appealLetter = typeof parsed.appealLetter === "string" ? parsed.appealLetter : ""
    const evidenceChecklist = Array.isArray(parsed.evidenceChecklist)
      ? parsed.evidenceChecklist.filter((item): item is string => typeof item === "string")
      : []

    // Treat a missing or empty appeal letter as a generation failure so the
    // caller can surface a retryable error rather than showing blank content.
    if (!appealLetter.trim()) {
      logServerWarn("Appeal parse: appealLetter empty", {
        rawSnippet: raw.slice(0, 300),
      })
      return null
    }

    return { explanation, appealLetter, evidenceChecklist }
  } catch (err) {
    logServerWarn("Appeal parse: JSON.parse failed", {
      parseError: err instanceof Error ? err.message : String(err),
      rawSnippet: raw.slice(0, 300),
    })
    return null
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = (await request.json().catch(() => null)) as unknown
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: ERROR_APPEAL_INVALID_PAYLOAD }, { status: 400 })
    }

    const { denialReasonId, denialDetails, documentText } = parsed.data
    const denialReason = APPEAL_DENIAL_REASONS.find((r) => r.id === denialReasonId)
    if (!denialReason) {
      return NextResponse.json({ ok: false, error: ERROR_APPEAL_INVALID_PAYLOAD }, { status: 400 })
    }

    // ── Cache lookup ────────────────────────────────────────────────────────
    const inputHash = computeInputHash(denialDetails, documentText)
    const cached = await getCachedAppealAnalysis(authResult.userId, denialReasonId, inputHash)
    if (cached) {
      return NextResponse.json({ ok: true, analysis: cached, fromCache: true }, { status: 200 })
    }

    const ragChunks = await retrieveRelevantChunks(
      `${denialReason.label} MassHealth appeal`,
      APPEAL_RAG_TOP_K,
    ).catch(() => [])
    const ragContext = formatChunksForPrompt(ragChunks)

    const systemPrompt = buildAppealSystemPrompt(denialReason, denialDetails, ragContext, documentText)

    const { text: rawContent } = await generateText({
      model: getOllamaModel(),
      system: systemPrompt,
      messages: [{ role: "user", content: "Generate the appeal analysis." }],
      temperature: OLLAMA_TEMPERATURE,
      maxOutputTokens: APPEAL_ANALYZE_MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(APPEAL_ANALYZE_TIMEOUT_MS),
    })

    if (!rawContent.trim()) {
      return NextResponse.json({ ok: false, error: ERROR_APPEAL_OLLAMA_FAILED }, { status: 502 })
    }

    const analysis = parseAppealAnalysis(rawContent)
    if (!analysis) {
      return NextResponse.json({ ok: false, error: ERROR_APPEAL_OLLAMA_FAILED }, { status: 502 })
    }

    const qualityGate = await reviewAppealLetterQuality({
      appealLetter: analysis.appealLetter,
      explanation: analysis.explanation,
      evidenceChecklist: analysis.evidenceChecklist,
      policyContext: ragContext,
    })

    const finalAnalysis: AppealAnalysis = { ...analysis, appealLetter: qualityGate.finalText }

    // Persist before responding so the cache row is guaranteed to exist when
    // the user re-submits the same document.  saveAppealAnalysis swallows all
    // errors internally so this never blocks a successful response.
    await saveAppealAnalysis(authResult.userId, denialReasonId, inputHash, finalAnalysis)

    return NextResponse.json({
      ok: true,
      analysis: finalAnalysis,
      reflection: qualityGate.review,
    }, { status: 200 })
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError"
    logServerError(ERROR_APPEAL_LOG_PREFIX, error, {
      route: "/api/appeals/analyze",
      errorType: error instanceof Error ? error.name : typeof error,
      aborted: isAbort,
    })
    return NextResponse.json(
      { ok: false, error: ERROR_APPEAL_OLLAMA_FAILED },
      { status: isAbort ? 504 : 500 },
    )
  }
}
