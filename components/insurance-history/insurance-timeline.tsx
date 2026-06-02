// components/insurance-history/insurance-timeline.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMessage } from "@/lib/i18n/messages"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { TimelineEntry } from "./timeline-entry"
import { CoverageForm } from "./coverage-form"
import { CoverageChart } from "./coverage-chart"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface InsuranceTimelineProps {
  items: CoverageRecordWithExplanation[]
  isLoading?: boolean
  loadError?: string | null
  language?: SupportedLanguage
}

/** Group items by coverage year, preserving descending order. */
function groupByYear(items: CoverageRecordWithExplanation[]): { year: number; entries: CoverageRecordWithExplanation[] }[] {
  const map = new Map<number, CoverageRecordWithExplanation[]>()
  for (const item of items) {
    const y = item.record.coverageYear
    if (!map.has(y)) map.set(y, [])
    map.get(y)!.push(item)
  }
  // Items arrive sorted DESC by year from the API; preserve that order
  return Array.from(map.entries()).map(([year, entries]) => ({ year, entries }))
}

export function InsuranceTimeline({ items: initialItems, isLoading, loadError, language = "en" }: InsuranceTimelineProps) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)

  // Derive visible items from the prop so new data from the parent is
  // reflected immediately (avoids the useState(prop) stale-copy trap).
  const items = initialItems.filter((i) => !deletedIds.has(i.record.id))
  const editRecord = editingId ? items.find((i) => i.record.id === editingId)?.record : null
  const yearGroups = groupByYear(items)

  function handleDeleted(id: string) {
    setDeletedIds((prev) => new Set([...prev, id]))
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">{getMessage(language, "insuranceHistoryTimelineTitle")}</h2>
        <Button size="sm" variant="outline" onClick={() => setAddingNew(true)}>
          <Plus className="w-4 h-4 mr-1" />
          {getMessage(language, "insuranceHistoryAddPast")}
        </Button>
      </div>

      <CoverageChart items={items} />

      {isLoading ? (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 border rounded-lg p-4 space-y-2">
                <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <p className="text-sm text-destructive py-4">{loadError}</p>
      ) : yearGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {getMessage(language, "insuranceHistoryEmpty")}
        </div>
      ) : (
        yearGroups.map(({ year, entries }, groupIndex) => {
          const isLastGroup = groupIndex === yearGroups.length - 1
          return (
            <div key={year} className="flex items-start gap-4">
              {/* Year bubble + connector line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow">
                  {year}
                </div>
                {!isLastGroup && <div className="w-0.5 flex-1 min-h-8 bg-border mt-1" />}
              </div>

              {/* All plans for this year, stacked */}
              <div className="flex-1 pb-6 space-y-2">
                {entries.map((item, entryIndex) => (
                  <TimelineEntry
                    key={item.record.id}
                    item={item}
                    isFirst={groupIndex === 0 && entryIndex === 0}
                    isLast={false}
                    onEdit={setEditingId}
                    onDeleted={handleDeleted}
                    language={language}
                    showYear={false}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}

      {(addingNew || editRecord) && (
        <CoverageForm
          record={editRecord ?? null}
          onClose={() => {
            setAddingNew(false)
            setEditingId(null)
          }}
          onSaved={() => {
            setAddingNew(false)
            setEditingId(null)
            window.location.reload()
          }}
          language={language}
        />
      )}
    </div>
  )
}
