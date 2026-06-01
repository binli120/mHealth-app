// components/insurance-history/coverage-form.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getMessage } from "@/lib/i18n/messages"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import type { CoverageRecord } from "@/lib/insurance-history/types"

// Common MA coverage plans grouped by type
const PLAN_OPTIONS: { group: string; plans: { label: string; code: string }[] }[] = [
  {
    group: "MassHealth (Medicaid)",
    plans: [
      { label: "MassHealth CarePlus", code: "careplus" },
      { label: "MassHealth Standard", code: "masshealth_standard" },
      { label: "MassHealth Standard – Pregnancy", code: "pregnancy_standard" },
      { label: "MassHealth Standard (Dual Eligible)", code: "dual_eligible_standard" },
      { label: "MassHealth Family Assistance (CHIP)", code: "family_assistance_chip" },
      { label: "MassHealth CommonHealth", code: "masshealth_commonhealth" },
      { label: "MassHealth Limited", code: "masshealth_limited" },
    ],
  },
  {
    group: "Health Connector",
    plans: [
      { label: "ConnectorCare Plan 1", code: "connectorcare_1" },
      { label: "ConnectorCare Plan 2", code: "connectorcare_2" },
      { label: "ConnectorCare Plan 3", code: "connectorcare_3" },
      { label: "Health Connector with Federal Tax Credits", code: "federal_tax_credits" },
      { label: "Health Connector (Unsubsidized)", code: "employer_or_connector" },
      { label: "Health Connector Plans (Children)", code: "health_connector_child_plans" },
    ],
  },
  {
    group: "Medicare",
    plans: [
      { label: "Medicare Part A & B", code: "medicare" },
      { label: "Medicare Advantage (Part C)", code: "medicare_advantage" },
      { label: "Medicare Savings Program", code: "medicare_savings_program_adult" },
      { label: "Medicare Supplement (Medigap)", code: "medigap_plans" },
    ],
  },
  {
    group: "Employer & Marketplace",
    plans: [
      { label: "Employer-Sponsored Insurance", code: "employer_sponsored_insurance" },
      { label: "ACA Marketplace Plan (Bronze)", code: "marketplace_bronze" },
      { label: "ACA Marketplace Plan (Silver)", code: "marketplace_silver" },
      { label: "ACA Marketplace Plan (Gold)", code: "marketplace_gold" },
    ],
  },
]

const ALL_PLANS = PLAN_OPTIONS.flatMap((g) => g.plans)
const OTHER_VALUE = "__other__"

function resolvePlanName(planName: string): { selected: string; custom: string } {
  const match = ALL_PLANS.find((p) => p.label === planName)
  if (match) return { selected: match.code, custom: "" }
  if (planName) return { selected: OTHER_VALUE, custom: planName }
  return { selected: "", custom: "" }
}

interface CoverageFormProps {
  record: CoverageRecord | null
  existingYears: number[]
  onClose: () => void
  onSaved: () => void
  language: SupportedLanguage
}

interface FormState {
  coverageYear: string
  selectedPlanCode: string
  customPlanName: string
  premiumMonthly: string
  householdSize: string
  annualIncome: string
  notes: string
}

export function CoverageForm({ record, existingYears, onClose, onSaved, language }: CoverageFormProps) {
  const isEditing = record !== null
  const currentYear = new Date().getFullYear()

  const { selected, custom } = resolvePlanName(record?.planName ?? "")

  const [form, setForm] = useState<FormState>({
    coverageYear: record ? String(record.coverageYear) : String(currentYear),
    selectedPlanCode: selected,
    customPlanName: custom,
    premiumMonthly: record?.premiumMonthly != null ? String(record.premiumMonthly) : "",
    householdSize: record?.householdSize != null ? String(record.householdSize) : "",
    annualIncome: record?.annualIncome != null ? String(record.annualIncome) : "",
    notes: record?.notes ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function setField(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function resolvedPlanName(): string {
    if (form.selectedPlanCode === OTHER_VALUE) return form.customPlanName.trim()
    return ALL_PLANS.find((p) => p.code === form.selectedPlanCode)?.label ?? ""
  }

  function resolvedProgramCode(): string | null {
    if (form.selectedPlanCode === OTHER_VALUE || !form.selectedPlanCode) return null
    return form.selectedPlanCode
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const year = parseInt(form.coverageYear, 10)
    if (!isEditing && existingYears.includes(year)) {
      setError(getMessage(language, "insuranceHistoryDuplicateYear").replace("{year}", String(year)))
      return
    }
    const planName = resolvedPlanName()
    if (!planName) {
      setError(getMessage(language, "insuranceHistoryPlanRequired"))
      return
    }

    setSaving(true)
    try {
      const body = {
        coverageYear: year,
        planName,
        programCode: resolvedProgramCode(),
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? getMessage(language, "insuranceHistoryEditDrawerTitle")
              : getMessage(language, "insuranceHistoryAddDrawerTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="coverage-year">{getMessage(language, "insuranceHistoryCoverageYear")} *</Label>
            <Input
              id="coverage-year"
              type="number"
              min="1990"
              max={currentYear}
              value={form.coverageYear}
              onChange={setField("coverageYear")}
              disabled={isEditing}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>{getMessage(language, "insuranceHistoryPlanName")} *</Label>
            <Select
              value={form.selectedPlanCode}
              onValueChange={(val) => setForm((f) => ({ ...f, selectedPlanCode: val, customPlanName: "" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={getMessage(language, "insuranceHistoryPlanNamePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((group) => (
                  <SelectGroup key={group.group}>
                    <SelectLabel>{group.group}</SelectLabel>
                    {group.plans.map((plan) => (
                      <SelectItem key={plan.code} value={plan.code}>
                        {plan.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                <SelectGroup>
                  <SelectLabel>Other</SelectLabel>
                  <SelectItem value={OTHER_VALUE}>Other / Not listed</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {form.selectedPlanCode === OTHER_VALUE && (
            <div className="space-y-1">
              <Label htmlFor="custom-plan">Plan name *</Label>
              <Input
                id="custom-plan"
                placeholder="Enter plan name"
                value={form.customPlanName}
                onChange={setField("customPlanName")}
                autoFocus
                required
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="premium">{getMessage(language, "insuranceHistoryPremium")}</Label>
            <Input
              id="premium"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.premiumMonthly}
              onChange={setField("premiumMonthly")}
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
              onChange={setField("householdSize")}
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
              onChange={setField("annualIncome")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">{getMessage(language, "insuranceHistoryNotes")}</Label>
            <Input
              id="notes"
              placeholder={getMessage(language, "insuranceHistoryNotesPlaceholder")}
              value={form.notes}
              onChange={setField("notes")}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {getMessage(language, "insuranceHistoryCancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? getMessage(language, "insuranceHistorySaving")
                : isEditing
                  ? getMessage(language, "insuranceHistorySave")
                  : getMessage(language, "insuranceHistoryAddRecord")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
