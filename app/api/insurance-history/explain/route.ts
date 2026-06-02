/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { getCoverageRecord, saveExplanation } from "@/lib/db/insurance-history"
import {
  applyRulesTemplate,
  buildLlmPrompt,
  computeChangeFactor,
  FALLBACK_EXPLANATION,
} from "@/lib/insurance-history/explanation-engine"

const anthropic = new Anthropic()

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = await request.json().catch(() => null)
    if (!body?.coverageRecordId) {
      return NextResponse.json({ ok: false, error: "coverageRecordId is required" }, { status: 400 })
    }

    const current = await getCoverageRecord(body.coverageRecordId, authResult.userId)
    if (!current) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 })

    const prior = body.priorRecordId
      ? await getCoverageRecord(body.priorRecordId, authResult.userId)
      : null

    const cf = computeChangeFactor(current, prior)
    const rulesText = applyRulesTemplate(current, prior)

    let explanationText: string
    let generatedBy: "rules" | "llm" = "rules"

    if (rulesText !== null) {
      explanationText = rulesText
    } else if (prior) {
      try {
        const prompt = buildLlmPrompt(current, prior, cf)
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        })
        const content = msg.content[0]
        explanationText = content.type === "text" ? content.text.trim() : FALLBACK_EXPLANATION
        generatedBy = "llm"
      } catch {
        explanationText = FALLBACK_EXPLANATION
      }
    } else {
      explanationText = FALLBACK_EXPLANATION
    }

    const explanation = await saveExplanation({
      coverageRecordId: current.id,
      priorRecordId: prior?.id ?? null,
      changeFactors: cf,
      explanationText,
      generatedBy,
    })

    return NextResponse.json({ ok: true, explanation })
  } catch (err) {
    console.error("[insurance-history/explain POST]", err)
    return NextResponse.json({ ok: false, error: "Failed to generate explanation" }, { status: 500 })
  }
}
