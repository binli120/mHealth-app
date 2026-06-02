// components/insurance-history/timeline-entry.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { Pencil, Trash2, ChevronDown, ChevronUp, FileText, UserCheck, Bot, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getMessage } from "@/lib/i18n/messages"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
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

interface TimelineEntryProps {
  item: CoverageRecordWithExplanation
  isFirst: boolean
  isLast: boolean
  showYear?: boolean   // false when the parent year-group renders the bubble
  onEdit: (id: string) => void
  onDeleted: (id: string) => void
  language: SupportedLanguage
}

export function TimelineEntry({ item, isFirst, isLast, showYear = true, onEdit, onDeleted, language }: TimelineEntryProps) {
  const [expanded, setExpanded] = useState(isFirst)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { record, explanation } = item
  const color = bubbleColor(record.programCode)

  const sourceLabel = {
    platform: getMessage(language, "insuranceHistorySourcePlatform"),
    self_reported: getMessage(language, "insuranceHistorySelfReported"),
    document_extracted: getMessage(language, "insuranceHistoryDocExtracted"),
  }[record.source]

  const sourceIcon = {
    platform: <FileText className="w-3 h-3" />,
    self_reported: <UserCheck className="w-3 h-3" />,
    document_extracted: <Bot className="w-3 h-3" />,
  }[record.source]

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await authenticatedFetch(`/api/insurance-history/records/${record.id}`, {
        method: "DELETE",
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload.ok) {
        setDeleteError(payload.error ?? "Failed to delete record.")
        return
      }
      setConfirmOpen(false)
      onDeleted(record.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
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
              <div className="flex items-center gap-1 flex-shrink-0">
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  {sourceIcon}
                  {sourceLabel}
                </Badge>
                {record.source !== "platform" && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onEdit(record.id)}
                      aria-label="Edit record"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmOpen(true)}
                      aria-label="Delete record"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}

            {explanation && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {getMessage(language, "insuranceHistoryWhyThisPlan")}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {record.coverageYear} coverage record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove your <strong>{record.planName}</strong> ({record.coverageYear}) entry.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete() }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
