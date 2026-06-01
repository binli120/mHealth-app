// components/insurance-history/insurance-summary-card.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import Link from "next/link"
import { History } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface InsuranceSummaryCardProps {
  latest: CoverageRecordWithExplanation | null
}

export function InsuranceSummaryCard({ latest }: InsuranceSummaryCardProps) {
  const description = latest
    ? latest.record.planName +
      (latest.record.coverageYear ? ` · ${latest.record.coverageYear}` : "") +
      (latest.record.premiumMonthly != null
        ? ` · $${latest.record.premiumMonthly.toFixed(0)}/mo`
        : "")
    : "No coverage history on file yet."

  return (
    <Link href="/customer/insurance-history" className="h-full">
      <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-card-foreground">Insurance History</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
