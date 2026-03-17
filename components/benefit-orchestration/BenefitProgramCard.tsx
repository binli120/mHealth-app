"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, ExternalLink, Phone, Clock, FileText, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { BenefitResult, BenefitCategory, EligibilityStatus } from "@/lib/benefit-orchestration/types"
import { getMessage } from "@/lib/i18n/messages"
import { useAppSelector } from "@/lib/redux/hooks"

const CATEGORY_LABEL_KEYS: Record<BenefitCategory, Parameters<typeof getMessage>[1]> = {
  healthcare: "bsCategoryHealthcare",
  food: "bsCategoryFood",
  housing: "bsCategoryHousing",
  childcare: "bsCategoryChildcare",
  utility: "bsCategoryUtility",
  cash: "bsCategoryCash",
  tax_credit: "bsCategoryTaxCredit",
}

const CATEGORY_ICONS: Record<BenefitCategory, string> = {
  healthcare: "🏥",
  food: "🛒",
  housing: "🏠",
  childcare: "👶",
  utility: "⚡",
  cash: "💵",
  tax_credit: "📋",
}

const STATUS_STYLES: Record<EligibilityStatus, { badge: string; border: string; dot: string }> = {
  likely: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    border: "border-l-4 border-l-emerald-500",
    dot: "bg-emerald-500",
  },
  possibly: {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    border: "border-l-4 border-l-amber-500",
    dot: "bg-amber-500",
  },
  unlikely: {
    badge: "bg-gray-100 text-gray-600 border-gray-200",
    border: "border-l-4 border-l-gray-300",
    dot: "bg-gray-400",
  },
  ineligible: {
    badge: "bg-red-100 text-red-700 border-red-200",
    border: "border-l-4 border-l-red-300",
    dot: "bg-red-400",
  },
}

const STATUS_LABEL_KEYS: Record<EligibilityStatus, Parameters<typeof getMessage>[1]> = {
  likely: "bsStatusLikely",
  possibly: "bsStatusPossibly",
  unlikely: "bsStatusUnlikely",
  ineligible: "bsStatusIneligible",
}

interface BenefitProgramCardProps {
  result: BenefitResult
  isQuickWin?: boolean
  compact?: boolean
}

export function BenefitProgramCard({ result, isQuickWin, compact }: BenefitProgramCardProps) {
  const language = useAppSelector((state) => state.app.language)
  const [expanded, setExpanded] = useState(false)
  const styles = STATUS_STYLES[result.eligibilityStatus]

  return (
    <Card className={`relative overflow-hidden transition-shadow hover:shadow-md ${styles.border}`}>
      {isQuickWin && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
            <Zap className="h-3 w-3" /> {getMessage(language, "bsQuickWin")}
          </span>
        </div>
      )}

      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5" aria-hidden>
            {CATEGORY_ICONS[result.category]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-base text-gray-900 leading-tight">{result.programName}</h3>
              <Badge variant="outline" className={`text-xs shrink-0 ${styles.badge}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${styles.dot}`} />
                {getMessage(language, STATUS_LABEL_KEYS[result.eligibilityStatus])}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">{getMessage(language, CATEGORY_LABEL_KEYS[result.category])} · {result.administeredBy}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Value */}
        {result.estimatedMonthlyValue > 0 && (
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-gray-900">
              ~${result.estimatedMonthlyValue.toLocaleString()}<span className="text-gray-500 font-normal">{getMessage(language, "bsMonthSuffix")}</span>
              {result.estimatedAnnualValue > 0 && (
                <span className="text-xs text-gray-400 ml-2">(${result.estimatedAnnualValue.toLocaleString()}{getMessage(language, "bsYearSuffix")})</span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{result.valueNote}</p>
          </div>
        )}

        {/* Waitlist warning */}
        {result.waitlistWarning && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-800">{result.waitlistWarning}</p>
          </div>
        )}

        {/* Processing time */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{result.processingTime}</span>
        </div>

        {/* Expandable details */}
        {!compact && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span>{expanded ? getMessage(language, "bsHideDetails") : getMessage(language, "bsViewDetails")}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}

        {(expanded || compact) && (
          <div className="space-y-3 border-t pt-3">
            {result.keyRequirements.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">{getMessage(language, "bsKeyRequirements")}</p>
                <ul className="space-y-1">
                  {result.keyRequirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="mt-0.5 text-gray-400 shrink-0">•</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.requiredDocuments.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {getMessage(language, "bsDocumentsNeeded")}
                </p>
                <ul className="space-y-1">
                  {result.requiredDocuments.map((doc, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="mt-0.5 text-gray-400 shrink-0">•</span>
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.nextSteps.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">{getMessage(language, "bsNextSteps")}</p>
                <ol className="space-y-1">
                  {result.nextSteps.map((step, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="font-medium text-gray-400 shrink-0 mt-0.5">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {result.applicationUrl && (
            <Button size="sm" asChild>
              {result.applicationUrl.startsWith("http") ? (
                <a href={result.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                  {getMessage(language, "bsApplyNow")} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <a href={result.applicationUrl} className="inline-flex items-center gap-1.5">
                  {getMessage(language, "bsApplyNow")}
                </a>
              )}
            </Button>
          )}
          {result.applicationPhone && (
            <Button variant="outline" size="sm" asChild className="min-w-0 max-w-full">
              <a href={`tel:${result.applicationPhone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5 min-w-0">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{result.applicationPhone}</span>
              </a>
            </Button>
          )}
        </div>

        {result.applicationNote && (
          <p className="text-xs text-gray-400 italic">{result.applicationNote}</p>
        )}
      </CardContent>
    </Card>
  )
}
