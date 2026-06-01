// components/insurance-history/coverage-form.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getMessage } from "@/lib/i18n/messages"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { CoverageRecord } from "@/lib/insurance-history/types"

interface CoverageFormProps {
  record: CoverageRecord | null
  existingYears: number[]
  onClose: () => void
  onSaved: () => void
  language: SupportedLanguage
}

interface FormState {
  coverageYear: string
  planName: string
  premiumMonthly: string
  householdSize: string
  annualIncome: string
  notes: string
}

export function CoverageForm({ record, existingYears, onClose, onSaved, language }: CoverageFormProps) {
  const isEditing = record !== null
  const currentYear = new Date().getFullYear()

  const [form, setForm] = useState<FormState>({
    coverageYear: record ? String(record.coverageYear) : String(currentYear),
    planName: record?.planName ?? "",
    premiumMonthly: record?.premiumMonthly != null ? String(record.premiumMonthly) : "",
    householdSize: record?.householdSize != null ? String(record.householdSize) : "",
    annualIncome: record?.annualIncome != null ? String(record.annualIncome) : "",
    notes: record?.notes ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const year = parseInt(form.coverageYear, 10)
    if (!isEditing && existingYears.includes(year)) {
      setError(getMessage(language, "insuranceHistoryDuplicateYear").replace("{year}", String(year)))
      return
    }
    if (!form.planName.trim()) {
      setError(getMessage(language, "insuranceHistoryPlanRequired"))
      return
    }

    setSaving(true)
    try {
      const body = {
        coverageYear: year,
        planName: form.planName.trim(),
        premiumMonthly: form.premiumMonthly ? parseFloat(form.premiumMonthly) : null,
        householdSize: form.householdSize ? parseInt(form.householdSize, 10) : null,
        annualIncome: form.annualIncome ? parseFloat(form.annualIncome) : null,
        notes: form.notes || null,
      }

      const url = isEditing
        ? `/api/insurance-history/records/${record!.id}`
        : "/api/insurance-history/records"
      const method = isEditing ? "PUT" : "POST"

      const res = await authenticatedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? getMessage(language, "insuranceHistoryError"))
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? getMessage(language, "insuranceHistoryEditDrawerTitle")
              : getMessage(language, "insuranceHistoryAddDrawerTitle")}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="coverage-year">{getMessage(language, "insuranceHistoryCoverageYear")} *</Label>
            <Input
              id="coverage-year"
              type="number"
              min="1990"
              max={currentYear}
              value={form.coverageYear}
              onChange={set("coverageYear")}
              disabled={isEditing}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-name">{getMessage(language, "insuranceHistoryPlanName")} *</Label>
            <Input
              id="plan-name"
              placeholder={getMessage(language, "insuranceHistoryPlanNamePlaceholder")}
              value={form.planName}
              onChange={set("planName")}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="premium">{getMessage(language, "insuranceHistoryPremium")}</Label>
            <Input
              id="premium"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.premiumMonthly}
              onChange={set("premiumMonthly")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="household">{getMessage(language, "insuranceHistoryHousehold")}</Label>
            <Input
              id="household"
              type="number"
              min="1"
              placeholder="1"
              value={form.householdSize}
              onChange={set("householdSize")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="income">{getMessage(language, "insuranceHistoryIncome")}</Label>
            <Input
              id="income"
              type="number"
              min="0"
              placeholder="0"
              value={form.annualIncome}
              onChange={set("annualIncome")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">{getMessage(language, "insuranceHistoryNotes")}</Label>
            <Input
              id="notes"
              placeholder={getMessage(language, "insuranceHistoryNotesPlaceholder")}
              value={form.notes}
              onChange={set("notes")}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              {getMessage(language, "insuranceHistoryCancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? getMessage(language, "insuranceHistorySaving")
                : isEditing
                  ? getMessage(language, "insuranceHistorySave")
                  : getMessage(language, "insuranceHistoryAddRecord")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
