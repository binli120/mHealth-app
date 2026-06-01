// components/insurance-history/insurance-timeline.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimelineEntry } from "./timeline-entry"
import { CoverageForm } from "./coverage-form"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"

interface InsuranceTimelineProps {
  items: CoverageRecordWithExplanation[]
  isLoading?: boolean
  loadError?: string | null
}

export function InsuranceTimeline({ items, isLoading, loadError }: InsuranceTimelineProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)

  const editRecord = editingId ? items.find((i) => i.record.id === editingId)?.record : null

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Coverage Timeline</h2>
        <Button size="sm" variant="outline" onClick={() => setAddingNew(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add past coverage
        </Button>
      </div>

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
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No coverage records yet. Add your first one to get started.
        </div>
      ) : (
        items.map((item, index) => (
          <TimelineEntry
            key={item.record.id}
            item={item}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onEdit={setEditingId}
          />
        ))
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
          existingYears={items.map((i) => i.record.coverageYear)}
        />
      )}
    </div>
  )
}
