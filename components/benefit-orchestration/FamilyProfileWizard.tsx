/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useStepWizard } from "@/hooks/use-step-wizard"
import { Plus, Trash2, ChevronRight, ChevronLeft, Loader2, Users, DollarSign, Home, FileCheck, User, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DobInput } from "@/components/shared/DobInput"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { CurrencyInput } from "@/components/shared/CurrencyInput"
import { InfoBox } from "@/components/shared/InfoBox"
import {
  CITIZENSHIP_OPTIONS,
  EMPLOYMENT_OPTIONS,
  HOUSING_OPTIONS,
  FILING_STATUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
  UTILITY_OPTIONS,
} from "@/lib/constants/form-options"
import type {
  BenefitStack,
  FamilyProfile,
  HouseholdMemberProfile,
  IncomeBreakdown,
  CitizenshipStatus,
  EmploymentStatus,
  HousingStatus,
  TaxFilingStatus,
  UtilityType,
  RelationshipType,
} from "@/lib/benefit-orchestration/types"
import { emptyIncome } from "@/lib/benefit-orchestration/fpl-utils"
import { type SupportedLanguage } from "@/lib/i18n/languages"
import { getMessage } from "@/lib/i18n/messages"
import { useAppSelector } from "@/lib/redux/hooks"
import { getSafeSupabaseSession } from "@/lib/supabase/client"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { createUuid } from "@/lib/utils/random-id"

const STEP_LABELS = [
  { key: "bsStep0", icon: User },
  { key: "bsStep1", icon: Users },
  { key: "bsStep2", icon: DollarSign },
  { key: "bsStep3", icon: Home },
  { key: "bsStep4", icon: FileCheck },
  { key: "bsStep5", icon: Star },
] as const

function IncomeSection({
  income,
  language,
  onChange,
  label,
}: {
  income: IncomeBreakdown
  language: SupportedLanguage
  onChange: (v: IncomeBreakdown) => void
  label: string
}) {
  const update = (key: keyof IncomeBreakdown, value: number) => onChange({ ...income, [key]: value })
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CurrencyInput label={getMessage(language, "bsWagesSalary")} value={income.wages} onChange={(v) => update("wages", v)} description={getMessage(language, "bsWagesDesc")} />
        <CurrencyInput label={getMessage(language, "bsSelfEmployment")} value={income.selfEmployment} onChange={(v) => update("selfEmployment", v)} description={getMessage(language, "bsSelfEmploymentDesc")} />
        <CurrencyInput label={getMessage(language, "bsSocialSecurity")} value={income.socialSecurity} onChange={(v) => update("socialSecurity", v)} />
        <CurrencyInput label={getMessage(language, "bsSsiLabel")} value={income.ssi} onChange={(v) => update("ssi", v)} />
        <CurrencyInput label={getMessage(language, "bsUnemploymentLabel")} value={income.unemployment} onChange={(v) => update("unemployment", v)} />
        <CurrencyInput label={getMessage(language, "bsPensionLabel")} value={income.pension} onChange={(v) => update("pension", v)} />
        <CurrencyInput label={getMessage(language, "bsChildSupportLabel")} value={income.childSupport} onChange={(v) => update("childSupport", v)} />
        <CurrencyInput label={getMessage(language, "bsOtherIncomeLabel")} value={income.other} onChange={(v) => update("other", v)} />
      </div>
    </div>
  )
}

const emptyMember = (): HouseholdMemberProfile => ({
  id: createUuid(),
  firstName: "",
  relationship: "child",
  dateOfBirth: "",
  age: 0,
  pregnant: false,
  disabled: false,
  over65: false,
  citizenshipStatus: "citizen",
  hasMedicare: false,
  income: emptyIncome(),
  isTaxDependent: true,
  isStudent: false,
  isCaringForChild: false,
})


const defaultProfile = (): Omit<FamilyProfile, "householdSize" | "childrenUnder5" | "childrenUnder13" | "childrenUnder18" | "childrenUnder19"> => ({
  dateOfBirth: "",
  age: 0,
  pregnant: false,
  disabled: false,
  blind: false,
  over65: false,
  hasMedicare: false,
  hasPrivateInsurance: false,
  hasEmployerInsurance: false,
  citizenshipStatus: "citizen",
  stateResident: true,
  employmentStatus: "not_working",
  income: emptyIncome(),
  assets: { bankAccounts: 0, investments: 0, realEstate: 0, vehicles: 0, other: 0 },
  housingStatus: "renter",
  utilityTypes: [],
  taxFiler: false,
  isTaxDependent: false,
  householdMembers: [],
})

interface FamilyProfileWizardProps {
  initialProfile?: Partial<FamilyProfile>
  onComplete: (stack: BenefitStack) => void
  loading?: boolean
}

export function FamilyProfileWizard({ initialProfile, onComplete, loading }: FamilyProfileWizardProps) {
  const language = useAppSelector((state) => state.app.language)
  const { step, goNext, goPrev, goTo, isFirst } = useStepWizard(STEP_LABELS.length)
  const [profile, setProfile] = useState<ReturnType<typeof defaultProfile>>({
    ...defaultProfile(),
    ...initialProfile,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Keyboard navigation ──────────────────────────────────────────────────
  // Ref attached to the tabpanel so we can find its <h2> and move focus to it.
  const stepPanelRef = useRef<HTMLDivElement>(null)
  // Per-tab button refs for arrow-key focus management (roving tabindex).
  const tabRefs = useRef<(HTMLButtonElement | null)[]>(new Array(STEP_LABELS.length).fill(null))
  // Skip programmatic focus on the very first render — don't steal focus from
  // whatever triggered the wizard to mount.
  const isInitialMount = useRef(true)

  // Whenever the active step changes, move keyboard focus to the panel heading
  // so screen-reader and keyboard-only users land in the right context.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const heading = stepPanelRef.current?.querySelector<HTMLElement>("h2")
    if (heading) {
      // tabindex="-1" lets the heading receive programmatic focus without
      // appearing in the natural tab order.
      heading.setAttribute("tabindex", "-1")
      heading.focus({ preventScroll: false })
    }
  }, [step])

  // WAI-ARIA tabs pattern: arrow keys navigate between tabs; Tab key jumps
  // out of the tablist entirely (roving tabindex — only active tab is tabbable).
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      const last = STEP_LABELS.length - 1
      let target = -1
      if (e.key === "ArrowRight") target = idx < last ? idx + 1 : 0
      else if (e.key === "ArrowLeft") target = idx > 0 ? idx - 1 : last
      else if (e.key === "Home") target = 0
      else if (e.key === "End") target = last
      if (target >= 0) {
        e.preventDefault()
        goTo(target)
        tabRefs.current[target]?.focus()
      }
    },
    [goTo],
  )

  const update = useCallback(<K extends keyof typeof profile>(key: K, value: (typeof profile)[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addMember = () => setProfile((prev) => ({ ...prev, householdMembers: [...prev.householdMembers, emptyMember()] }))

  const removeMember = (id: string) =>
    setProfile((prev) => ({ ...prev, householdMembers: prev.householdMembers.filter((m) => m.id !== id) }))

  const updateMember = (id: string, patch: Partial<HouseholdMemberProfile>) =>
    setProfile((prev) => ({
      ...prev,
      householdMembers: prev.householdMembers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))

  const toggleUtility = (type: UtilityType) => {
    const current = profile.utilityTypes
    update("utilityTypes", current.includes(type) ? current.filter((u) => u !== type) : [...current, type])
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const { session } = await getSafeSupabaseSession()
      if (!session?.access_token) {
        setError(getMessage(language, "bsSignInRequired"))
        return
      }
      const res = await fetch("/api/benefit-orchestration/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(profile),
      })

      // Guard: if the response isn't JSON (e.g. a 404/500 HTML page due to a
      // wrong dev-server port), surface a clear message instead of a raw
      // SyntaxError from res.json().
      const contentType = res.headers.get("content-type") ?? ""
      if (!contentType.includes("application/json")) {
        const hint = process.env.NODE_ENV === "development"
          ? " (Dev tip: make sure you're on http://127.0.0.1:3000, not localhost:3000)"
          : ""
        throw new Error(`Server returned an unexpected response (HTTP ${res.status}).${hint}`)
      }

      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Failed to evaluate benefits.")
      onComplete(data.stack)
    } catch (err) {
      setError(toUserFacingError(err, "Unable to evaluate benefits. Please try again."))
    } finally {
      setSubmitting(false)
    }
  }

  const totalMonthly = Object.values(profile.income).reduce((a, v) => a + v, 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Live region — announces the new step name whenever the user navigates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Step ${step + 1} of ${STEP_LABELS.length}: ${getMessage(language, STEP_LABELS[step].key)}`}
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-2" aria-hidden="true">
          <span>Step {step + 1} of {STEP_LABELS.length}</span>
          <span>{getMessage(language, STEP_LABELS[step].key)}</span>
        </div>
        <Progress
          value={((step + 1) / STEP_LABELS.length) * 100}
          className="h-1.5"
          aria-label="Form completion"
          aria-valuetext={`Step ${step + 1} of ${STEP_LABELS.length}: ${getMessage(language, STEP_LABELS[step].key)}`}
        />
      </div>

      {/* Step tabs */}
      <div
        role="tablist"
        aria-label="Form sections"
        className="flex gap-1 overflow-x-auto pb-1"
      >
        {STEP_LABELS.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={i}
              id={`step-tab-${i}`}
              role="tab"
              type="button"
              // Roving tabindex: only the active tab is in the tab order.
              // Keyboard users navigate between tabs with ← / → / Home / End.
              tabIndex={i === step ? 0 : -1}
              aria-selected={i === step}
              aria-controls="step-panel"
              onClick={() => goTo(i)}
              onKeyDown={(e) => handleTabKeyDown(e, i)}
              ref={(el) => { tabRefs.current[i] = el }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === step
                  ? "bg-blue-600 text-white"
                  : i < step
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {getMessage(language, s.key)}
            </button>
          )
        })}
      </div>

      <Card>
        <CardContent
          id="step-panel"
          role="tabpanel"
          aria-labelledby={`step-tab-${step}`}
          ref={stepPanelRef}
          className="pt-6 space-y-5"
        >
          {/* ── Step 0: About You ── */}
          {step === 0 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">{getMessage(language, "bsAboutYouTitle")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DobInput
                  id="dob-applicant"
                  label={getMessage(language, "bsDateOfBirth")}
                  value={profile.dateOfBirth ?? ""}
                  onChange={(iso, age) => {
                    update("dateOfBirth", iso)
                    update("age", age)
                  }}
                />
                <div>
                  <Label id="citizenship-label" className="text-sm">{getMessage(language, "bsCitizenshipStatus")}</Label>
                  <Select value={profile.citizenshipStatus} onValueChange={(v) => update("citizenshipStatus", v as CitizenshipStatus)}>
                    <SelectTrigger className="mt-1" aria-labelledby="citizenship-label"><SelectValue /></SelectTrigger>
                    <SelectContent>{CITIZENSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label id="employment-label" className="text-sm">{getMessage(language, "bsEmploymentStatus")}</Label>
                <Select value={profile.employmentStatus} onValueChange={(v) => update("employmentStatus", v as EmploymentStatus)}>
                  <SelectTrigger className="mt-1" aria-labelledby="employment-label"><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <Separator />
              <div role="group" aria-labelledby="situation-group-label" className="space-y-3">
                <p id="situation-group-label" className="text-sm font-medium text-gray-700">{getMessage(language, "bsYourSituation")}</p>
                {[
                  { key: "pregnant", label: getMessage(language, "bsPregnantCheck") },
                  { key: "disabled", label: getMessage(language, "bsDisabilityCheck") },
                  { key: "blind", label: getMessage(language, "bsBlindCheck") },
                  { key: "over65", label: getMessage(language, "bsOver65Check") },
                  { key: "hasMedicare", label: getMessage(language, "bsMedicareCheck") },
                  { key: "hasEmployerInsurance", label: getMessage(language, "bsEmployerInsCheck") },
                  { key: "hasPrivateInsurance", label: getMessage(language, "bsPrivateInsCheck") },
                  { key: "stateResident", label: getMessage(language, "bsMaResidentCheck") },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={!!profile[key as keyof typeof profile]}
                      onCheckedChange={(v) => update(key as keyof typeof profile, !!v as never)}
                    />
                    <label htmlFor={key} className="text-sm text-gray-700 cursor-pointer">{label}</label>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Step 1: Household ── */}
          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">{getMessage(language, "bsHouseholdTitle")}</h2>
              <p className="text-sm text-gray-500">{getMessage(language, "bsHouseholdDesc")}</p>

              {profile.householdMembers.length === 0 && (
                <p className="text-sm text-gray-400 italic">{getMessage(language, "bsNoMembers")}</p>
              )}

              <div className="space-y-4">
                {profile.householdMembers.map((member) => (
                  <Card key={member.id} className="border border-gray-200">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-gray-800" id={`member-name-${member.id}`}>
                          {member.firstName || getMessage(language, "bsMemberLabel")}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.id)}
                          aria-label={`Remove ${member.firstName || getMessage(language, "bsMemberLabel")}`}
                          className="text-red-500 hover:text-red-700 h-7 px-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`member-name-input-${member.id}`} className="text-xs">{getMessage(language, "bsFirstNameOptional")}</Label>
                          <Input id={`member-name-input-${member.id}`} value={member.firstName ?? ""} onChange={(e) => updateMember(member.id, { firstName: e.target.value })} placeholder="Name" className="mt-1 text-sm" />
                        </div>
                        <DobInput
                          id={`dob-member-${member.id}`}
                          label={getMessage(language, "bsDateOfBirth")}
                          labelClassName="text-xs"
                          value={member.dateOfBirth ?? ""}
                          onChange={(iso, age) => updateMember(member.id, { dateOfBirth: iso, age })}
                          className="text-sm"
                        />
                        <div>
                          <Label id={`member-rel-label-${member.id}`} className="text-xs">{getMessage(language, "bsRelationshipLabel")}</Label>
                          <Select value={member.relationship} onValueChange={(v) => updateMember(member.id, { relationship: v as RelationshipType })}>
                            <SelectTrigger className="mt-1 text-sm" aria-labelledby={`member-rel-label-${member.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{RELATIONSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label id={`member-cit-label-${member.id}`} className="text-xs">{getMessage(language, "bsCitizenshipStatus")}</Label>
                          <Select value={member.citizenshipStatus} onValueChange={(v) => updateMember(member.id, { citizenshipStatus: v as CitizenshipStatus })}>
                            <SelectTrigger className="mt-1 text-sm" aria-labelledby={`member-cit-label-${member.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{CITIZENSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div role="group" aria-labelledby={`member-flags-label-${member.id}`} className="flex flex-wrap gap-3 text-sm">
                        <span id={`member-flags-label-${member.id}`} className="sr-only">
                          {`Health and status for ${member.firstName || getMessage(language, "bsMemberLabel")}`}
                        </span>
                        {[
                          { key: "pregnant", label: getMessage(language, "bsMemberPregnant") },
                          { key: "disabled", label: getMessage(language, "bsMemberDisabled") },
                          { key: "over65", label: getMessage(language, "bsMemberOver65") },
                          { key: "hasMedicare", label: getMessage(language, "bsMemberMedicare") },
                          { key: "isTaxDependent", label: getMessage(language, "bsMemberTaxDependent") },
                          { key: "isStudent", label: getMessage(language, "bsMemberStudent") },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`${member.id}-${key}`}
                              checked={!!member[key as keyof HouseholdMemberProfile]}
                              onCheckedChange={(v) => updateMember(member.id, { [key]: !!v } as Partial<HouseholdMemberProfile>)}
                            />
                            <label htmlFor={`${member.id}-${key}`} className="text-xs cursor-pointer">{label}</label>
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">{getMessage(language, "bsMemberMonthlyIncome")}</Label>
                        <div className="grid grid-cols-1 gap-2 mt-1 sm:grid-cols-2">
                          <CurrencyInput label={getMessage(language, "bsMemberWages")} value={member.income.wages} onChange={(v) => updateMember(member.id, { income: { ...member.income, wages: v } })} />
                          <CurrencyInput label={getMessage(language, "bsMemberSsSsi")} value={member.income.socialSecurity + member.income.ssi + member.income.other} onChange={(v) => updateMember(member.id, { income: { ...member.income, other: v } })} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button variant="outline" onClick={addMember} className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> {getMessage(language, "bsAddMember")}
              </Button>
            </>
          )}

          {/* ── Step 2: Your Income ── */}
          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">{getMessage(language, "bsIncomeTitle")}</h2>
              <p className="text-sm text-gray-500">{getMessage(language, "bsIncomeDesc")}</p>
              <IncomeSection income={profile.income} language={language} onChange={(v) => update("income", v)} label={getMessage(language, "bsPrimaryIncomeLabel")} />
              {totalMonthly > 0 && (
                <InfoBox variant="info">
                  <span className="font-medium">{getMessage(language, "bsMonthlyTotal")} ${totalMonthly.toLocaleString()}{getMessage(language, "bsMonthSuffix")}</span>
                </InfoBox>
              )}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="taxFiler" checked={profile.taxFiler} onCheckedChange={(v) => update("taxFiler", !!v)} />
                  <label htmlFor="taxFiler" className="text-sm cursor-pointer">{getMessage(language, "bsTaxFilerCheck")}</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="isTaxDependent" checked={!!profile.isTaxDependent} onCheckedChange={(v) => update("isTaxDependent", !!v)} />
                  <label htmlFor="isTaxDependent" className="text-sm cursor-pointer">
                    Someone else can claim me as a dependent
                  </label>
                </div>
                {profile.taxFiler && (
                  <div>
                    <Label className="text-sm">{getMessage(language, "bsFilingStatusLabel")}</Label>
                    <Select value={profile.filingStatus ?? ""} onValueChange={(v) => update("filingStatus", v as TaxFilingStatus)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select filing status" /></SelectTrigger>
                      <SelectContent>{FILING_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Step 3: Housing ── */}
          {step === 3 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">{getMessage(language, "bsHousingTitle")}</h2>
              <div>
                <Label id="housing-status-label" className="text-sm">{getMessage(language, "bsCurrentHousing")}</Label>
                <Select value={profile.housingStatus} onValueChange={(v) => update("housingStatus", v as HousingStatus)}>
                  <SelectTrigger className="mt-1" aria-labelledby="housing-status-label"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOUSING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {(profile.housingStatus === "renter") && (
                <div>
                  <Label htmlFor="monthly-rent" className="text-sm">{getMessage(language, "bsMonthlyRent")}</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">$</span>
                    <Input
                      id="monthly-rent"
                      type="number"
                      min={0}
                      value={profile.monthlyRent || ""}
                      onChange={(e) => update("monthlyRent", Number(e.target.value) || 0)}
                      className="pl-7"
                      placeholder="e.g. 1500"
                      aria-label={getMessage(language, "bsMonthlyRent")}
                    />
                  </div>
                </div>
              )}

              <Separator />
              <div role="group" aria-labelledby="utilities-group-label">
                <p id="utilities-group-label" className="text-sm font-medium text-gray-700 mb-3">{getMessage(language, "bsUtilitiesQuestion")}</p>
                <div className="space-y-2">
                  {UTILITY_OPTIONS.map((u) => (
                    <div key={u.value} className="flex items-center gap-2">
                      <Checkbox id={`utility-${u.value}`} checked={profile.utilityTypes.includes(u.value)} onCheckedChange={() => toggleUtility(u.value)} />
                      <label htmlFor={`utility-${u.value}`} className="text-sm cursor-pointer">{u.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 4: Assets ── */}
          {step === 4 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">{getMessage(language, "bsAssetsTitle")}</h2>
              <p className="text-sm text-gray-500">{getMessage(language, "bsAssetsDesc")}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <CurrencyInput label={getMessage(language, "bsBankAccounts")} value={profile.assets.bankAccounts} onChange={(v) => update("assets", { ...profile.assets, bankAccounts: v })} />
                <CurrencyInput label={getMessage(language, "bsInvestments")} value={profile.assets.investments} onChange={(v) => update("assets", { ...profile.assets, investments: v })} />
                <CurrencyInput label={getMessage(language, "bsRealEstate")} value={profile.assets.realEstate} onChange={(v) => update("assets", { ...profile.assets, realEstate: v })} />
                <CurrencyInput label={getMessage(language, "bsOtherAssets")} value={profile.assets.other} onChange={(v) => update("assets", { ...profile.assets, other: v })} />
              </div>
              <InfoBox className="text-xs">
                Note: Most MassHealth and SNAP programs do not count your primary home, one vehicle, or retirement accounts as assets.
              </InfoBox>
            </>
          )}

          {/* ── Step 5: Review ── */}
          {step === 5 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">{getMessage(language, "bsReviewTitle")}</h2>
              <p className="text-sm text-gray-500">{getMessage(language, "bsReviewDesc")}</p>
              <dl className="rounded-lg bg-gray-50 border border-gray-200 divide-y divide-gray-200 text-sm">
                {[
                  { label: "Age", value: profile.age },
                  { label: "Citizenship", value: CITIZENSHIP_OPTIONS.find((o) => o.value === profile.citizenshipStatus)?.label },
                  { label: "Employment", value: EMPLOYMENT_OPTIONS.find((o) => o.value === profile.employmentStatus)?.label },
                  { label: "Household size", value: `${1 + profile.householdMembers.length} people` },
                  { label: "MA resident", value: profile.stateResident ? "Yes" : "No" },
                  { label: "Pregnant", value: profile.pregnant ? "Yes" : "No" },
                  { label: "Disability / SSI", value: profile.disabled ? "Yes" : "No" },
                  { label: "Medicare", value: profile.hasMedicare ? "Yes" : "No" },
                  { label: "Housing", value: HOUSING_OPTIONS.find((o) => o.value === profile.housingStatus)?.label },
                  { label: "Monthly income (self)", value: `$${Object.values(profile.income).reduce((a, v) => a + v, 0).toLocaleString()}` },
                  { label: "Claimed as dependent", value: profile.isTaxDependent ? "Yes" : "No" },
                  { label: "Utilities", value: profile.utilityTypes.length > 0 ? profile.utilityTypes.join(", ") : "None" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between px-3 py-2">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900">{String(value ?? "—")}</dd>
                  </div>
                ))}
              </dl>

              {error && (
                <InfoBox variant="error" role="alert">{error}</InfoBox>
              )}

              <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting || loading}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> Evaluating your benefits...</>
                ) : (
                  getMessage(language, "bsSeeMyBenefits")
                )}
              </Button>
              <p className="text-xs text-gray-400 text-center">
                {getMessage(language, "bsPrivacyNote")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goPrev} disabled={isFirst}>
          <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" /> {getMessage(language, "bsBack")}
        </Button>
        {step < 5 && (
          <Button onClick={goNext}>
            {getMessage(language, "bsNext")} <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}
