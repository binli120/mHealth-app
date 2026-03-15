import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { retrieveRelevantChunks, formatChunksForPrompt } from "@/lib/rag/retrieve"
import { logServerError } from "@/lib/server/logger"
import { buildAppealSystemPrompt } from "@/lib/appeals/prompts"
import {
  APPEAL_DENIAL_REASONS,
  APPEAL_DENIAL_REASON_IDS,
  APPEAL_DETAILS_MAX_LENGTH,
  APPEAL_RAG_TOP_K,
  ERROR_APPEAL_INVALID_PAYLOAD,
  ERROR_APPEAL_OLLAMA_FAILED,
  ERROR_APPEAL_LOG_PREFIX,
} from "@/lib/appeals/constants"
import type { AppealAnalysis } from "@/lib/appeals/types"
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  OLLAMA_CHAT_ENDPOINT,
  OLLAMA_TEMPERATURE,
  OLLAMA_TIMEOUT_MS,
} from "@/app/api/chat/masshealth/constants"

export const runtime = "nodejs"

const requestSchema = z.object({
  denialReasonId: z.enum(APPEAL_DENIAL_REASON_IDS),
  denialDetails: z.string().trim().max(APPEAL_DETAILS_MAX_LENGTH).default(""),
  documentText: z.string().trim().max(8000).optional(),
})

interface OllamaResponsePayload {
  message?: { role?: string; content?: string }
}

function getOllamaBaseUrl(): string {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL
  return baseUrl.replace(/\/+$/, "")
}

function parseAppealAnalysis(raw: string): AppealAnalysis {
  // Strip markdown fences if the model wrapped the JSON
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const explanation = typeof parsed.explanation === "string" ? parsed.explanation : ""
    const appealLetter = typeof parsed.appealLetter === "string" ? parsed.appealLetter : ""
    const evidenceChecklist = Array.isArray(parsed.evidenceChecklist)
      ? parsed.evidenceChecklist.filter((item): item is string => typeof item === "string")
      : []

    return { explanation, appealLetter, evidenceChecklist }
  } catch {
    // Graceful fallback: return raw content as explanation
    return { explanation: cleaned, appealLetter: "", evidenceChecklist: [] }
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

    const ragChunks = await retrieveRelevantChunks(
      `${denialReason.label} MassHealth appeal`,
      APPEAL_RAG_TOP_K,
    ).catch(() => [])
    const ragContext = formatChunksForPrompt(ragChunks)

    const systemPrompt = buildAppealSystemPrompt(denialReason, denialDetails, ragContext, documentText)

    const ollamaResponse = await fetch(
      `${getOllamaBaseUrl()}${OLLAMA_CHAT_ENDPOINT}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
          stream: false,
          options: { temperature: OLLAMA_TEMPERATURE },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate the appeal analysis." },
          ],
        }),
      },
    )

    if (!ollamaResponse.ok) {
      return NextResponse.json({ ok: false, error: ERROR_APPEAL_OLLAMA_FAILED }, { status: 502 })
    }

    const ollamaData = (await ollamaResponse.json()) as OllamaResponsePayload
    const rawContent = ollamaData.message?.content?.trim() ?? ""
    if (!rawContent) {
      return NextResponse.json({ ok: false, error: ERROR_APPEAL_OLLAMA_FAILED }, { status: 502 })
    }

    const analysis = parseAppealAnalysis(rawContent)

    return NextResponse.json({ ok: true, analysis }, { status: 200 })
  } catch (error) {
    logServerError(ERROR_APPEAL_LOG_PREFIX, error, { route: "/api/appeals/analyze" })
    return NextResponse.json({ ok: false, error: ERROR_APPEAL_OLLAMA_FAILED }, { status: 500 })
  }
}
