// components/insurance-history/insurance-summary-card.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import Link from "next/link"
import { History } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getMessage } from "@/lib/i18n/messages"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface InsuranceSummaryCardProps {
  latest: CoverageRecordWithExplanation | null
  language?: SupportedLanguage
}

export function InsuranceSummaryCard({ latest, language = "en" }: InsuranceSummaryCardProps) {
  const description = latest
    ? latest.record.planName +
      (latest.record.coverageYear ? ` · ${latest.record.coverageYear}` : "") +
      (latest.record.premiumMonthly != null
        ? ` · $${latest.record.premiumMonthly.toFixed(0)}/mo`
        : "")
    : getMessage(language, "insuranceHistoryNoCoverage")

  return (
    <Link href="/customer/insurance-history" className="h-full" aria-label="View full history">
      <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-card-foreground">{getMessage(language, "insuranceHistoryTitle")}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
