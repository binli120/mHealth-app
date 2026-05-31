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
}

export function InsuranceTimeline({ items }: InsuranceTimelineProps) {
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

      {items.length === 0 ? (
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
