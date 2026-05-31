// app/customer/insurance-history/page.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
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
import { InsuranceTimeline } from "@/components/insurance-history/insurance-timeline"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

export default async function InsuranceHistoryPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const records = await listCoverageRecords(user.id)

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

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Insurance History</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your coverage history and why it changed each year.
        </p>
      </div>
      <InsuranceTimeline items={items} />
    </main>
  )
}
