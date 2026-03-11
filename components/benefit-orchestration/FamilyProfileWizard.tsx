"use client"

import { useState, useCallback } from "react"
import { Plus, Trash2, ChevronRight, ChevronLeft, Loader2, Users, DollarSign, Home, FileCheck, User, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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

const STEP_LABELS = [
  { label: "About You", icon: User },
  { label: "Household", icon: Users },
  { label: "Your Income", icon: DollarSign },
  { label: "Housing", icon: Home },
  { label: "Assets", icon: FileCheck },
  { label: "Review", icon: Star },
]

const CITIZENSHIP_OPTIONS: { value: CitizenshipStatus; label: string }[] = [
  { value: "citizen", label: "US Citizen or US National" },
  { value: "qualified_immigrant", label: "Qualified Immigrant (LPR, refugee, asylee, etc.)" },
  { value: "other", label: "Other immigration status" },
  { value: "undocumented", label: "Undocumented / No immigration status" },
]

const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: "employed", label: "Employed (W-2)" },
  { value: "self_employed", label: "Self-employed / Freelance" },
  { value: "unemployed", label: "Unemployed / Looking for work" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
  { value: "not_working", label: "Not currently working" },
]

const HOUSING_OPTIONS: { value: HousingStatus; label: string }[] = [
  { value: "renter", label: "Renter" },
  { value: "owner", label: "Homeowner" },
  { value: "living_with_family", label: "Living with family / others (no rent)" },
  { value: "homeless", label: "Experiencing homelessness" },
  { value: "shelter", label: "In a shelter or transitional housing" },
  { value: "other", label: "Other" },
]

const FILING_STATUS_OPTIONS: { value: TaxFilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "head_of_household", label: "Head of Household" },
  { value: "married_filing_jointly", label: "Married Filing Jointly" },
  { value: "married_filing_separately", label: "Married Filing Separately" },
  { value: "qualifying_widow", label: "Qualifying Surviving Spouse" },
]

const RELATIONSHIP_OPTIONS: { value: RelationshipType; label: string }[] = [
  { value: "spouse", label: "Spouse" },
  { value: "partner", label: "Domestic partner" },
  { value: "child", label: "Child" },
  { value: "stepchild", label: "Stepchild" },
  { value: "grandchild", label: "Grandchild" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "grandparent", label: "Grandparent" },
  { value: "other_relative", label: "Other relative" },
  { value: "non_relative", label: "Non-relative" },
]

const UTILITY_OPTIONS: { value: UtilityType; label: string }[] = [
  { value: "heat", label: "Heating (oil, gas, wood)" },
  { value: "electricity", label: "Electricity" },
  { value: "gas", label: "Natural gas" },
  { value: "other", label: "Other utility" },
]

function CurrencyInput({
  label,
  value,
  onChange,
  description,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  description?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      {description && <p className="text-xs text-gray-400">{description}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <Input
          type="number"
          min={0}
          step={1}
          value={value || ""}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="pl-7 text-sm"
          placeholder="0"
        />
      </div>
    </div>
  )
}

function IncomeSection({ income, onChange, label }: { income: IncomeBreakdown; onChange: (v: IncomeBreakdown) => void; label: string }) {
  const update = (key: keyof IncomeBreakdown, value: number) => onChange({ ...income, [key]: value })
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput label="Wages / Salary" value={income.wages} onChange={(v) => update("wages", v)} description="Monthly gross (before taxes)" />
        <CurrencyInput label="Self-employment" value={income.selfEmployment} onChange={(v) => update("selfEmployment", v)} description="Monthly net income" />
        <CurrencyInput label="Social Security" value={income.socialSecurity} onChange={(v) => update("socialSecurity", v)} />
        <CurrencyInput label="SSI" value={income.ssi} onChange={(v) => update("ssi", v)} />
        <CurrencyInput label="Unemployment" value={income.unemployment} onChange={(v) => update("unemployment", v)} />
        <CurrencyInput label="Pension / Retirement" value={income.pension} onChange={(v) => update("pension", v)} />
        <CurrencyInput label="Child Support received" value={income.childSupport} onChange={(v) => update("childSupport", v)} />
        <CurrencyInput label="Other income" value={income.other} onChange={(v) => update("other", v)} />
      </div>
    </div>
  )
}

const emptyMember = (): HouseholdMemberProfile => ({
  id: crypto.randomUUID(),
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
  const [step, setStep] = useState(0)
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
      const res = await fetch("/api/benefit-orchestration/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          <span>{STEP_LABELS[step].label}</span>
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
              onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                i === step
                  ? "bg-blue-600 text-white"
                  : i < step
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          )
        })}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* ── Step 0: About You ── */}
          {step === 0 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">Tell us about yourself</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age" className="text-sm">Your age</Label>
                  <Input id="age" type="number" min={0} max={120} value={profile.age || ""} onChange={(e) => update("age", Number(e.target.value) || 0)} placeholder="e.g. 32" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Citizenship status</Label>
                  <Select value={profile.citizenshipStatus} onValueChange={(v) => update("citizenshipStatus", v as CitizenshipStatus)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CITIZENSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm">Employment status</Label>
                <Select value={profile.employmentStatus} onValueChange={(v) => update("employmentStatus", v as EmploymentStatus)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Your situation (check all that apply)</p>
                {[
                  { key: "pregnant", label: "I am currently pregnant" },
                  { key: "disabled", label: "I have a documented disability or receive SSI/SSDI" },
                  { key: "blind", label: "I am legally blind" },
                  { key: "over65", label: "I am 65 or older" },
                  { key: "hasMedicare", label: "I am enrolled in Medicare" },
                  { key: "hasEmployerInsurance", label: "I have insurance through an employer" },
                  { key: "hasPrivateInsurance", label: "I have other private health insurance" },
                  { key: "stateResident", label: "I live in Massachusetts" },
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
              <h2 className="text-base font-semibold text-gray-900">Who else lives in your household?</h2>
              <p className="text-sm text-gray-500">Include everyone who lives with you and shares expenses — spouse, children, parents, etc.</p>

              {profile.householdMembers.length === 0 && (
                <p className="text-sm text-gray-400 italic">No household members added yet. Click below to add someone.</p>
              )}

              <div className="space-y-4">
                {profile.householdMembers.map((member) => (
                  <Card key={member.id} className="border border-gray-200">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-gray-800">{member.firstName || "Household member"}</p>
                        <Button variant="ghost" size="sm" onClick={() => removeMember(member.id)} className="text-red-500 hover:text-red-700 h-7 px-2">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">First name (optional)</Label>
                          <Input value={member.firstName ?? ""} onChange={(e) => updateMember(member.id, { firstName: e.target.value })} placeholder="Name" className="mt-1 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Age</Label>
                          <Input type="number" min={0} max={120} value={member.age || ""} onChange={(e) => updateMember(member.id, { age: Number(e.target.value) || 0 })} className="mt-1 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Relationship to you</Label>
                          <Select value={member.relationship} onValueChange={(v) => updateMember(member.id, { relationship: v as RelationshipType })}>
                            <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{RELATIONSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Citizenship status</Label>
                          <Select value={member.citizenshipStatus} onValueChange={(v) => updateMember(member.id, { citizenshipStatus: v as CitizenshipStatus })}>
                            <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{CITIZENSHIP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {[
                          { key: "pregnant", label: "Pregnant" },
                          { key: "disabled", label: "Disabled" },
                          { key: "over65", label: "Age 65+" },
                          { key: "hasMedicare", label: "Has Medicare" },
                          { key: "isTaxDependent", label: "Tax dependent" },
                          { key: "isStudent", label: "Full-time student" },
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
                        <Label className="text-xs text-gray-600">Monthly income (if any)</Label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <CurrencyInput label="Wages" value={member.income.wages} onChange={(v) => updateMember(member.id, { income: { ...member.income, wages: v } })} />
                          <CurrencyInput label="SS / SSI / Other" value={member.income.socialSecurity + member.income.ssi + member.income.other} onChange={(v) => updateMember(member.id, { income: { ...member.income, other: v } })} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button variant="outline" onClick={addMember} className="w-full border-dashed">
                <Plus className="h-4 w-4 mr-2" /> Add household member
              </Button>
            </>
          )}

          {/* ── Step 2: Your Income ── */}
          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">Your monthly income</h2>
              <p className="text-sm text-gray-500">Enter approximate monthly amounts. Leave blank if $0.</p>
              <IncomeSection income={profile.income} onChange={(v) => update("income", v)} label="Primary applicant income" />
              {totalMonthly > 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                  <p className="text-sm text-blue-800 font-medium">Your monthly income total: ${totalMonthly.toLocaleString()}/month</p>
                </div>
              )}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="taxFiler" checked={profile.taxFiler} onCheckedChange={(v) => update("taxFiler", !!v)} />
                  <label htmlFor="taxFiler" className="text-sm cursor-pointer">I file a federal tax return</label>
                </div>
                {profile.taxFiler && (
                  <div>
                    <Label className="text-sm">Filing status</Label>
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
              <h2 className="text-base font-semibold text-gray-900">Housing &amp; utilities</h2>
              <div>
                <Label className="text-sm">Current housing situation</Label>
                <Select value={profile.housingStatus} onValueChange={(v) => update("housingStatus", v as HousingStatus)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOUSING_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {(profile.housingStatus === "renter") && (
                <div>
                  <Label className="text-sm">Monthly rent</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input type="number" min={0} value={profile.monthlyRent || ""} onChange={(e) => update("monthlyRent", Number(e.target.value) || 0)} className="pl-7" placeholder="e.g. 1500" />
                  </div>
                </div>
              )}

              <Separator />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Which utilities does your household pay? (check all that apply)</p>
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
              <h2 className="text-base font-semibold text-gray-900">Assets &amp; savings</h2>
              <p className="text-sm text-gray-500">Some programs consider assets. Enter approximate current values.</p>
              <div className="grid grid-cols-2 gap-4">
                <CurrencyInput label="Bank accounts (checking + savings)" value={profile.assets.bankAccounts} onChange={(v) => update("assets", { ...profile.assets, bankAccounts: v })} />
                <CurrencyInput label="Investments (stocks, retirement)" value={profile.assets.investments} onChange={(v) => update("assets", { ...profile.assets, investments: v })} />
                <CurrencyInput label="Real estate (not your home)" value={profile.assets.realEstate} onChange={(v) => update("assets", { ...profile.assets, realEstate: v })} />
                <CurrencyInput label="Other assets" value={profile.assets.other} onChange={(v) => update("assets", { ...profile.assets, other: v })} />
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-500">Note: Most MassHealth and SNAP programs do not count your primary home, one vehicle, or retirement accounts as assets.</p>
              </div>
            </>
          )}

          {/* ── Step 5: Review ── */}
          {step === 5 && (
            <>
              <h2 className="text-base font-semibold text-gray-900">Review your information</h2>
              <p className="text-sm text-gray-500">Check your answers before we evaluate your benefit eligibility.</p>
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
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting || loading}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Evaluating your benefits...</>
                ) : (
                  "See My Benefits Stack"
                )}
              </Button>
              <p className="text-xs text-gray-400 text-center">
                Your information is saved securely and only used to evaluate your eligibility.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < 5 && (
          <Button onClick={() => setStep((s) => s + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
