/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useState, useCallback } from "react"
import { useStepWizard } from "@/hooks/use-step-wizard"
import { Plus, Trash2, ChevronRight, ChevronLeft, Loader2, Users, DollarSign, Home, FileCheck, User, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
      <div className="grid grid-cols-2 gap-3">
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
  householdMembers: [],
})

interface FamilyProfileWizardProps {
  initialProfile?: Partial<FamilyProfile>
  onComplete: (stack: unknown) => void
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
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Failed to evaluate benefits.")
      onComplete(data.stack)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const totalMonthly = Object.values(profile.income).reduce((a, v) => a + v, 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Step {step + 1} of {STEP_LABELS.length}</span>
          <span>{getMessage(language, STEP_LABELS[step].key)}</span>
        </div>
        <Progress value={((step + 1) / STEP_LABELS.length) * 100} className="h-1.5" />
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STEP_LABELS.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === step
                  ? "bg-blue-600 text-white"
                  : i < step
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {getMessage(language, s.key)}
            </button>
          )
        })}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* ── Step 0: About You ── */}
          {step === 0 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">{getMessage(language, "bsAboutYouTitle")}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age" className="text-sm">{getMessage(language, "bsYourAge")}</Label>
                  <Input id="age" type="number" min={0} max={120} value={profile.age || ""} onChange={(e) => update("age", Number(e.target.value) || 0)} placeholder="e.g. 32" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">{getMessage(language, "bsCitizenshipStatus")}</Label>
                  <Select value={profile.citizenshipStatus} onValueChange={(v) => update("citizenshipStatus", v as CitizenshipStatus)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CITIZENSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm">{getMessage(language, "bsEmploymentStatus")}</Label>
                <Select value={profile.employmentStatus} onValueChange={(v) => update("employmentStatus", v as EmploymentStatus)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">{getMessage(language, "bsYourSituation")}</p>
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
                        <p className="text-sm font-medium text-gray-800">{member.firstName || getMessage(language, "bsMemberLabel")}</p>
                        <Button variant="ghost" size="sm" onClick={() => removeMember(member.id)} className="text-red-500 hover:text-red-700 h-7 px-2">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{getMessage(language, "bsFirstNameOptional")}</Label>
                          <Input value={member.firstName ?? ""} onChange={(e) => updateMember(member.id, { firstName: e.target.value })} placeholder="Name" className="mt-1 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{getMessage(language, "bsAgeLabel")}</Label>
                          <Input type="number" min={0} max={120} value={member.age || ""} onChange={(e) => updateMember(member.id, { age: Number(e.target.value) || 0 })} className="mt-1 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">{getMessage(language, "bsRelationshipLabel")}</Label>
                          <Select value={member.relationship} onValueChange={(v) => updateMember(member.id, { relationship: v as RelationshipType })}>
                            <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{RELATIONSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">{getMessage(language, "bsCitizenshipStatus")}</Label>
                          <Select value={member.citizenshipStatus} onValueChange={(v) => updateMember(member.id, { citizenshipStatus: v as CitizenshipStatus })}>
                            <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{CITIZENSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
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
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <CurrencyInput label={getMessage(language, "bsMemberWages")} value={member.income.wages} onChange={(v) => updateMember(member.id, { income: { ...member.income, wages: v } })} />
                          <CurrencyInput label={getMessage(language, "bsMemberSsSsi")} value={member.income.socialSecurity + member.income.ssi + member.income.other} onChange={(v) => updateMember(member.id, { income: { ...member.income, other: v } })} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button variant="outline" onClick={addMember} className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" /> {getMessage(language, "bsAddMember")}
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
                <Label className="text-sm">{getMessage(language, "bsCurrentHousing")}</Label>
                <Select value={profile.housingStatus} onValueChange={(v) => update("housingStatus", v as HousingStatus)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOUSING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {(profile.housingStatus === "renter") && (
                <div>
                  <Label className="text-sm">{getMessage(language, "bsMonthlyRent")}</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input type="number" min={0} value={profile.monthlyRent || ""} onChange={(e) => update("monthlyRent", Number(e.target.value) || 0)} className="pl-7" placeholder="e.g. 1500" />
                  </div>
                </div>
              )}

              <Separator />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">{getMessage(language, "bsUtilitiesQuestion")}</p>
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="rounded-lg bg-gray-50 border border-gray-200 divide-y divide-gray-200 text-sm">
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
                  { label: "Utilities", value: profile.utilityTypes.length > 0 ? profile.utilityTypes.join(", ") : "None" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between px-3 py-2">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-900">{String(value ?? "—")}</span>
                  </div>
                ))}
              </div>

              {error && (
                <InfoBox variant="error">{error}</InfoBox>
              )}

              <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting || loading}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Evaluating your benefits...</>
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
          <ChevronLeft className="h-4 w-4 mr-1" /> {getMessage(language, "bsBack")}
        </Button>
        {step < 5 && (
          <Button onClick={goNext}>
            {getMessage(language, "bsNext")} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
