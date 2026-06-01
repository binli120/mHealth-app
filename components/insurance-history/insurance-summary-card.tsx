// components/insurance-history/insurance-summary-card.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import Link from "next/link"
import { ChevronRight, History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface InsuranceSummaryCardProps {
  latest: CoverageRecordWithExplanation | null
}

export function InsuranceSummaryCard({ latest }: InsuranceSummaryCardProps) {
  return (
    <Card className="border-border bg-card hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
          <History className="h-5 w-5 text-primary" />
          Insurance History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latest ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-card-foreground">{latest.record.planName}</span>
              <Badge variant="outline">
                {latest.record.coverageYear}
              </Badge>
            </div>
            {latest.record.premiumMonthly != null && (
              <p className="text-sm text-muted-foreground">
                ${latest.record.premiumMonthly.toFixed(0)}/mo premium
              </p>
            )}
            {latest.explanation && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {latest.explanation.explanationText.split(".")[0]}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No coverage history on file yet.</p>
        )}
        <Link
          href="/customer/insurance-history"
          className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline font-medium"
        >
          View full history <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
