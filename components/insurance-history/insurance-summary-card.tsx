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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          Insurance History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latest ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{latest.record.planName}</span>
              <Badge variant="outline" className="text-xs">
                {latest.record.coverageYear}
              </Badge>
            </div>
            {latest.record.premiumMonthly != null && (
              <p className="text-xs text-muted-foreground">
                ${latest.record.premiumMonthly.toFixed(0)}/mo premium
              </p>
            )}
            {latest.explanation && (
              <p className="text-xs text-blue-700 dark:text-blue-400 line-clamp-2">
                {latest.explanation.explanationText.split(".")[0]}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No coverage history on file yet.</p>
        )}
        <Link
          href="/customer/insurance-history"
          className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
        >
          View full history <ChevronRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
