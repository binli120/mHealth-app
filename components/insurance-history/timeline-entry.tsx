// components/insurance-history/timeline-entry.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { Pencil, ChevronDown, ChevronUp, FileText, UserCheck, Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

const PROGRAM_COLORS: Record<string, string> = {
  careplus: "bg-blue-600",
  connectorcare: "bg-emerald-600",
  employer_sponsored_insurance: "bg-violet-600",
  employer_or_connector: "bg-violet-600",
  federal_tax_credits: "bg-orange-500",
  pregnancy_standard: "bg-pink-500",
  child_standard: "bg-sky-500",
  medicare_savings_program_senior: "bg-teal-600",
  dual_eligible_standard: "bg-teal-600",
}

function bubbleColor(programCode: string | null): string {
  return PROGRAM_COLORS[programCode ?? ""] ?? "bg-gray-400"
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  platform: { label: "From your application", icon: <FileText className="w-3 h-3" /> },
  self_reported: { label: "You added this", icon: <UserCheck className="w-3 h-3" /> },
  document_extracted: { label: "Extracted from document", icon: <Bot className="w-3 h-3" /> },
}

interface TimelineEntryProps {
  item: CoverageRecordWithExplanation
  isFirst: boolean
  isLast: boolean
  onEdit: (id: string) => void
}

export function TimelineEntry({ item, isFirst, isLast, onEdit }: TimelineEntryProps) {
  const [expanded, setExpanded] = useState(isFirst)
  const { record, explanation } = item
  const color = bubbleColor(record.programCode)
  const sourceInfo = SOURCE_LABELS[record.source]

  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center text-xs font-bold shadow`}
        >
          {record.coverageYear}
        </div>
        {!isLast && <div className="w-0.5 flex-1 min-h-8 bg-border mt-1" />}
      </div>

      <div className="flex-1 pb-6">
        <div className="border rounded-lg bg-card shadow-sm p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{record.planName}</p>
              {record.premiumMonthly != null && (
                <p className="text-xs text-muted-foreground">
                  ${record.premiumMonthly.toFixed(0)}/mo premium
                  {record.fplPercent != null && ` · ${Math.round(record.fplPercent)}% FPL`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                {sourceInfo.icon}
                {sourceInfo.label}
              </Badge>
              {record.source !== "platform" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onEdit(record.id)}
                  aria-label="Edit record"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {explanation && (
            <div>
              <button
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                onClick={() => setExpanded((v) => !v)}
              >
                Why this plan?
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expanded && (
                <p className="mt-1 text-xs leading-relaxed text-blue-900 dark:text-blue-200 bg-blue-50 dark:bg-blue-950 rounded p-2">
                  {explanation.explanationText}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
