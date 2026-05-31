/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  listCoverageRecords,
  getExplanation,
  saveExplanation,
} from "@/lib/db/insurance-history"
import {
  applyRulesTemplate,
  buildLlmPrompt,
  computeChangeFactor,
  FALLBACK_EXPLANATION,
} from "@/lib/insurance-history/explanation-engine"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

const anthropic = new Anthropic()

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const records = await listCoverageRecords(authResult.userId)

    const items: CoverageRecordWithExplanation[] = await Promise.all(
      records.map(async (record, index) => {
        const prior = records[index + 1] ?? null

        let explanation = await getExplanation(record.id)

        if (!explanation) {
          const cf = computeChangeFactor(record, prior)
          const rulesText = applyRulesTemplate(record, prior)

          let explanationText: string
          let generatedBy: "rules" | "llm" = "rules"

          if (rulesText !== null) {
            explanationText = rulesText
          } else if (prior) {
            try {
              const prompt = buildLlmPrompt(record, prior, cf)
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

          explanation = await saveExplanation({
            coverageRecordId: record.id,
            priorRecordId: prior?.id ?? null,
            changeFactors: cf,
            explanationText,
            generatedBy,
          })
        }

        return { record, explanation }
      }),
    )

    return NextResponse.json({ ok: true, records: items })
  } catch (err) {
    console.error("[insurance-history/records-with-explanations GET]", err)
    return NextResponse.json({ ok: false, error: "Failed to load insurance history" }, { status: 500 })
  }
}
