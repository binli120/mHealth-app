// components/insurance-history/coverage-form.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import React, { useState } from "react"
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
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2 } from "lucide-react"
import { getMessage } from "@/lib/i18n/messages"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import { formatCurrency, parseCurrency } from "@/lib/utils/input-format"
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

function getPlanLabel(code: string): string {
  if (code === OTHER_VALUE || !code) return ""
  return ALL_PLANS.find((p) => p.code === code)?.label ?? ""
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanEntry {
  key: string               // local React key only
  selectedPlanCode: string
  customPlanName: string
  premiumMonthly: string
  notes: string
}

interface CoverageFormProps {
  record: CoverageRecord | null  // null = new; non-null = editing single record
  onClose: () => void
  onSaved: () => void
  language: SupportedLanguage
}

function emptyPlan(key?: string): PlanEntry {
  return { key: key ?? String(Date.now()), selectedPlanCode: "", customPlanName: "", premiumMonthly: "", notes: "" }
}

// ── Plan row component ────────────────────────────────────────────────────────

interface PlanRowProps {
  plan: PlanEntry
  index: number
  canRemove: boolean
  onChange: (updated: PlanEntry) => void
  onRemove: () => void
  language: SupportedLanguage
}

function PlanRow({ plan, index, canRemove, onChange, onRemove, language }: PlanRowProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Plan {index + 1}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onRemove}
            aria-label="Remove plan"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <Label>{getMessage(language, "insuranceHistoryPlanName")} *</Label>
        <Select
          value={plan.selectedPlanCode}
          onValueChange={(val) => onChange({ ...plan, selectedPlanCode: val, customPlanName: "" })}
        >
          <SelectTrigger>
            <SelectValue placeholder={getMessage(language, "insuranceHistoryPlanNamePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((group) => (
              <SelectGroup key={group.group}>
                <SelectLabel>{group.group}</SelectLabel>
                {group.plans.map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
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

      {plan.selectedPlanCode === OTHER_VALUE && (
        <div className="space-y-1">
          <Label>Plan name *</Label>
          <Input
            placeholder="Enter plan name"
            value={plan.customPlanName}
            onChange={(e) => onChange({ ...plan, customPlanName: e.target.value })}
            autoFocus
          />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={`premium-${plan.key}`}>{getMessage(language, "insuranceHistoryPremium")}</Label>
        <Input
          id={`premium-${plan.key}`}
          type="text"
          inputMode="decimal"
          placeholder="$0.00"
          value={plan.premiumMonthly}
          onChange={(e) => onChange({ ...plan, premiumMonthly: formatCurrency(e.target.value) })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`notes-${plan.key}`}>{getMessage(language, "insuranceHistoryNotes")}</Label>
        <Input
          id={`notes-${plan.key}`}
          placeholder={getMessage(language, "insuranceHistoryNotesPlaceholder")}
          value={plan.notes}
          onChange={(e) => onChange({ ...plan, notes: e.target.value })}
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CoverageForm({ record, onClose, onSaved, language }: CoverageFormProps) {
  const isEditing = record !== null
  const currentYear = new Date().getFullYear()

  const { selected, custom } = resolvePlanName(record?.planName ?? "")

  // Shared year-level fields
  const [coverageYear, setCoverageYear] = useState(record ? String(record.coverageYear) : String(currentYear))
  const [householdSize, setHouseholdSize] = useState(record?.householdSize != null ? String(record.householdSize) : "")
  const [annualIncome, setAnnualIncome] = useState(record?.annualIncome != null ? formatCurrency(String(record.annualIncome)) : "")

  // Plan entries (one when editing, one empty when adding new)
  const [plans, setPlans] = useState<PlanEntry[]>([
    {
      key: "plan-0",
      selectedPlanCode: selected,
      customPlanName: custom,
      premiumMonthly: record?.premiumMonthly != null ? formatCurrency(String(record.premiumMonthly)) : "",
      notes: record?.notes ?? "",
    },
  ])

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const submittingRef = React.useRef(false)

  function updatePlan(index: number, updated: PlanEntry) {
    setPlans((prev) => prev.map((p, i) => (i === index ? updated : p)))
  }

  function addPlan() {
    setPlans((prev) => [...prev, emptyPlan(String(Date.now()))])
  }

  function removePlan(index: number) {
    setPlans((prev) => prev.filter((_, i) => i !== index))
  }

  function planNameOf(plan: PlanEntry): string {
    if (plan.selectedPlanCode === OTHER_VALUE) return plan.customPlanName.trim()
    return getPlanLabel(plan.selectedPlanCode)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null)

    const year = parseInt(coverageYear, 10)

    // Validate all plan names are filled
    for (const plan of plans) {
      if (!planNameOf(plan)) {
        setError(getMessage(language, "insuranceHistoryPlanRequired"))
        return
      }
    }

    // Check for duplicate plan names within the same submission
    const names = plans.map(planNameOf)
    if (new Set(names).size !== names.length) {
      setError("You've entered the same plan name more than once.")
      return
    }

    setSaving(true)
    try {

      if (isEditing) {
        // Single-record edit
        const plan = plans[0]
        const body = {
          planName: planNameOf(plan),
          programCode: plan.selectedPlanCode !== OTHER_VALUE ? plan.selectedPlanCode : null,
          premiumMonthly: plan.premiumMonthly ? parseCurrency(plan.premiumMonthly) : null,
          householdSize: householdSize ? parseInt(householdSize, 10) : null,
          annualIncome: annualIncome ? parseCurrency(annualIncome) : null,
          notes: plan.notes || null,
        }
        const res = await authenticatedFetch(`/api/insurance-history/records/${record!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || !payload.ok) {
          setError(payload.error ?? getMessage(language, "insuranceHistoryError"))
          return
        }
      } else {
        // New records — POST each plan sequentially
        for (const plan of plans) {
          const body = {
            coverageYear: year,
            planName: planNameOf(plan),
            programCode: plan.selectedPlanCode !== OTHER_VALUE ? plan.selectedPlanCode : null,
            premiumMonthly: plan.premiumMonthly ? parseCurrency(plan.premiumMonthly) : null,
            householdSize: householdSize ? parseInt(householdSize, 10) : null,
            annualIncome: annualIncome ? parseCurrency(annualIncome) : null,
            notes: plan.notes || null,
          }
          const res = await authenticatedFetch("/api/insurance-history/records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
          const payload = await res.json().catch(() => ({}))
          if (!res.ok || !payload.ok) {
            const isDuplicate = res.status === 409
            setError(
              isDuplicate
                ? `A record for ${year} ("${planNameOf(plan)}") already exists. Edit the existing entry instead.`
                : (payload.error ?? getMessage(language, "insuranceHistoryError"))
            )
            return
          }
        }
      }
      onSaved()
    } finally {
      setSaving(false)
      submittingRef.current = false
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
          className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? getMessage(language, "insuranceHistoryEditDrawerTitle")
              : getMessage(language, "insuranceHistoryAddDrawerTitle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Year-level shared fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="coverage-year">{getMessage(language, "insuranceHistoryCoverageYear")} *</Label>
              <Input
                id="coverage-year"
                type="number"
                min="1990"
                max={currentYear}
                value={coverageYear}
                onChange={(e) => setCoverageYear(e.target.value)}
                disabled={isEditing}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="household">{getMessage(language, "insuranceHistoryHousehold")}</Label>
              <Input
                id="household"
                type="number"
                min="1"
                placeholder="1"
                value={householdSize}
                onChange={(e) => setHouseholdSize(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="income">{getMessage(language, "insuranceHistoryIncome")}</Label>
            <Input
              id="income"
              type="text"
              inputMode="decimal"
              placeholder="$0"
              value={annualIncome}
              onChange={(e) => setAnnualIncome(formatCurrency(e.target.value))}
            />
          </div>

          <Separator />

          {/* Per-plan entries */}
          <div className="space-y-3">
            {plans.map((plan, index) => (
              <PlanRow
                key={plan.key}
                plan={plan}
                index={index}
                canRemove={plans.length > 1}
                onChange={(updated) => updatePlan(index, updated)}
                onRemove={() => removePlan(index)}
                language={language}
              />
            ))}
          </div>

          {/* Add another plan — only when creating new records */}
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addPlan}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add another plan for {coverageYear || "this year"}
            </Button>
          )}

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
                  : plans.length > 1
                    ? `Save ${plans.length} plans`
                    : getMessage(language, "insuranceHistoryAddRecord")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
