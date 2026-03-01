"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { WizardLayout } from "@/components/application/wizard-layout"
import { User, Users, DollarSign, Building2, Upload, FileCheck, Send, Plus, Trash2, Download } from "lucide-react"

const steps = [
  { id: "personal", title: "Personal Info", icon: User },
  { id: "household", title: "Household", icon: Users },
  { id: "income", title: "Income", icon: DollarSign },
  { id: "assets", title: "Assets", icon: Building2 },
  { id: "documents", title: "Documents", icon: Upload },
  { id: "review", title: "AI Review", icon: FileCheck },
  { id: "submit", title: "Submit", icon: Send },
]

interface HouseholdMember {
  id: string
  firstName: string
  lastName: string
  relationship: string
  dob: string
  ssn: string
  pregnant: boolean
  disabled: boolean
  over65: boolean
}

interface IncomeSource {
  id: string
  type: string
  employer: string
  amount: string
  frequency: string
}

interface ApplicationFormData {
  firstName: string
  lastName: string
  dob: string
  ssn: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  citizenship: string
  householdMembers: HouseholdMember[]
  incomeSources: IncomeSource[]
  hasAssets: string
  bankAccounts: string
  investments: string
  property: string
  documents: string[]
  certify: boolean
}

function getMonthlyIncome(incomeSources: IncomeSource[]): number {
  return incomeSources.reduce((sum, source) => {
    const amount = Number(source.amount || 0)

    if (!Number.isFinite(amount) || amount <= 0) {
      return sum
    }

    switch (source.frequency) {
      case "weekly":
        return sum + amount * 4
      case "biweekly":
        return sum + amount * 2
      case "yearly":
        return sum + amount / 12
      default:
        return sum + amount
    }
  }, 0)
}

export default function NewApplicationPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [formData, setFormData] = useState<ApplicationFormData>({
    // Personal Info
    firstName: "",
    lastName: "",
    dob: "",
    ssn: "",
    address: "",
    city: "",
    state: "MA",
    zip: "",
    phone: "",
    citizenship: "",
    // Household
    householdMembers: [] as HouseholdMember[],
    // Income
    incomeSources: [] as IncomeSource[],
    // Assets
    hasAssets: "no",
    bankAccounts: "",
    investments: "",
    property: "",
    // Documents
    documents: [] as string[],
    // Review
    certify: false,
  })

  const [newMember, setNewMember] = useState<Partial<HouseholdMember>>({})
  const [newIncome, setNewIncome] = useState<Partial<IncomeSource>>({})

  const stepsWithStatus = steps.map((step, index) => ({
    ...step,
    completed: index + 1 < currentStep,
    current: index + 1 === currentStep,
  }))

  const handleDownloadFilledPdf = async () => {
    setIsGeneratingPdf(true)

    try {
      const monthlyIncome = getMonthlyIncome(formData.incomeSources)
      const firstEmploymentIncome = formData.incomeSources.find((source) =>
        source.type === "employment" || source.type === "self-employment"
      )

      const payload = {
        firstName: formData.firstName || "Jane",
        lastName: formData.lastName || "Doe",
        dateOfBirth: formData.dob,
        ssn: formData.ssn,
        streetAddress: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zip,
        phone: formData.phone,
        householdSize: formData.householdMembers.length + 1,
        citizenship: (formData.citizenship || "citizen") as "citizen" | "permanent" | "refugee" | "other",
        employerName: firstEmploymentIncome?.employer || "",
        monthlyIncome,
        annualIncome: monthlyIncome * 12,
        signatureName: `${formData.firstName} ${formData.lastName}`.trim(),
      }

      const response = await fetch("/api/forms/aca-3-0325/fill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("Failed to generate filled PDF")
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `ACA-3-0325-${(formData.lastName || "application").toLowerCase()}-filled.pdf`
      link.click()
      window.URL.revokeObjectURL(downloadUrl)

      return true
    } catch (error) {
      console.error(error)
      window.alert("Could not generate filled ACA form. Please try again.")
      return false
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleNext = async () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
      return
    }

    const generated = await handleDownloadFilledPdf()
    if (generated) {
      router.push("/application/confirmation")
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const addHouseholdMember = () => {
    if (newMember.firstName && newMember.lastName) {
      setFormData({
        ...formData,
        householdMembers: [
          ...formData.householdMembers,
          {
            id: Date.now().toString(),
            firstName: newMember.firstName || "",
            lastName: newMember.lastName || "",
            relationship: newMember.relationship || "",
            dob: newMember.dob || "",
            ssn: newMember.ssn || "",
            pregnant: newMember.pregnant || false,
            disabled: newMember.disabled || false,
            over65: newMember.over65 || false,
          },
        ],
      })
      setNewMember({})
    }
  }

  const removeHouseholdMember = (id: string) => {
    setFormData({
      ...formData,
      householdMembers: formData.householdMembers.filter((m) => m.id !== id),
    })
  }

  const addIncomeSource = () => {
    if (newIncome.type && newIncome.amount) {
      setFormData({
        ...formData,
        incomeSources: [
          ...formData.incomeSources,
          {
            id: Date.now().toString(),
            type: newIncome.type || "",
            employer: newIncome.employer || "",
            amount: newIncome.amount || "",
            frequency: newIncome.frequency || "monthly",
          },
        ],
      })
      setNewIncome({})
    }
  }

  const removeIncomeSource = (id: string) => {
    setFormData({
      ...formData,
      incomeSources: formData.incomeSources.filter((s) => s.id !== id),
    })
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Personal Information</CardTitle>
              <CardDescription>
                Tell us about yourself. This information helps us verify your identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-foreground">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="border-input bg-background text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-foreground">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="border-input bg-background text-foreground"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-foreground">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="border-input bg-background text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ssn" className="text-foreground">Social Security Number</Label>
                  <Input
                    id="ssn"
                    placeholder="XXX-XX-XXXX"
                    value={formData.ssn}
                    onChange={(e) => setFormData({ ...formData, ssn: e.target.value })}
                    className="border-input bg-background text-foreground"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-foreground">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="border-input bg-background text-foreground"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-foreground">City</Label>
                  <Input
                    id="city"
                    placeholder="Boston"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="border-input bg-background text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-foreground">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                  >
                    <SelectTrigger className="border-input bg-background text-foreground">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MA">Massachusetts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip" className="text-foreground">ZIP Code</Label>
                  <Input
                    id="zip"
                    placeholder="02101"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="border-input bg-background text-foreground"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="border-input bg-background text-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="citizenship" className="text-foreground">Citizenship Status</Label>
                <Select
                  value={formData.citizenship}
                  onValueChange={(value) => setFormData({ ...formData, citizenship: value })}
                >
                  <SelectTrigger className="border-input bg-background text-foreground">
                    <SelectValue placeholder="Select citizenship status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="citizen">U.S. Citizen</SelectItem>
                    <SelectItem value="permanent">Permanent Resident</SelectItem>
                    <SelectItem value="refugee">Refugee/Asylee</SelectItem>
                    <SelectItem value="other">Other Immigration Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Household Information</CardTitle>
              <CardDescription>
                Add all members of your household who need coverage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Members */}
              {formData.householdMembers.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-foreground">Household Members</Label>
                  {formData.householdMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.relationship} • DOB: {member.dob}
                        </p>
                        <div className="mt-1 flex gap-2">
                          {member.pregnant && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                              Pregnant
                            </span>
                          )}
                          {member.disabled && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              Disabled
                            </span>
                          )}
                          {member.over65 && (
                            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
                              Over 65
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeHouseholdMember(member.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Member Form */}
              <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
                <Label className="text-foreground">Add Household Member</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    placeholder="First Name"
                    value={newMember.firstName || ""}
                    onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })}
                    className="border-input bg-background text-foreground"
                  />
                  <Input
                    placeholder="Last Name"
                    value={newMember.lastName || ""}
                    onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })}
                    className="border-input bg-background text-foreground"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    value={newMember.relationship || ""}
                    onValueChange={(value) => setNewMember({ ...newMember, relationship: value })}
                  >
                    <SelectTrigger className="border-input bg-background text-foreground">
                      <SelectValue placeholder="Relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    placeholder="Date of Birth"
                    value={newMember.dob || ""}
                    onChange={(e) => setNewMember({ ...newMember, dob: e.target.value })}
                    className="border-input bg-background text-foreground"
                  />
                </div>
                <Input
                  placeholder="SSN (XXX-XX-XXXX)"
                  value={newMember.ssn || ""}
                  onChange={(e) => setNewMember({ ...newMember, ssn: e.target.value })}
                  className="border-input bg-background text-foreground"
                />
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pregnant"
                      checked={newMember.pregnant || false}
                      onCheckedChange={(checked) =>
                        setNewMember({ ...newMember, pregnant: checked as boolean })
                      }
                    />
                    <Label htmlFor="pregnant" className="text-sm text-foreground">
                      Pregnant
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="disabled"
                      checked={newMember.disabled || false}
                      onCheckedChange={(checked) =>
                        setNewMember({ ...newMember, disabled: checked as boolean })
                      }
                    />
                    <Label htmlFor="disabled" className="text-sm text-foreground">
                      Disabled
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="over65"
                      checked={newMember.over65 || false}
                      onCheckedChange={(checked) =>
                        setNewMember({ ...newMember, over65: checked as boolean })
                      }
                    />
                    <Label htmlFor="over65" className="text-sm text-foreground">
                      Over 65
                    </Label>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addHouseholdMember}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Member
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Income Information</CardTitle>
              <CardDescription>
                Tell us about your household income sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Income Sources */}
              {formData.incomeSources.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-foreground">Income Sources</Label>
                  {formData.incomeSources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground capitalize">{source.type}</p>
                        {source.employer && (
                          <p className="text-sm text-muted-foreground">{source.employer}</p>
                        )}
                        <p className="text-sm font-medium text-accent">
                          ${source.amount} / {source.frequency}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIncomeSource(source.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Income Source */}
              <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
                <Label className="text-foreground">Add Income Source</Label>
                <Select
                  value={newIncome.type || ""}
                  onValueChange={(value) => setNewIncome({ ...newIncome, type: value })}
                >
                  <SelectTrigger className="border-input bg-background text-foreground">
                    <SelectValue placeholder="Income Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employment">Employment</SelectItem>
                    <SelectItem value="self-employment">Self-Employment</SelectItem>
                    <SelectItem value="unemployment">Unemployment Benefits</SelectItem>
                    <SelectItem value="social-security">Social Security</SelectItem>
                    <SelectItem value="pension">Pension/Retirement</SelectItem>
                    <SelectItem value="disability">Disability Benefits</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {(newIncome.type === "employment" || newIncome.type === "self-employment") && (
                  <Input
                    placeholder="Employer Name"
                    value={newIncome.employer || ""}
                    onChange={(e) => setNewIncome({ ...newIncome, employer: e.target.value })}
                    className="border-input bg-background text-foreground"
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    placeholder="Amount"
                    type="number"
                    value={newIncome.amount || ""}
                    onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                    className="border-input bg-background text-foreground"
                  />
                  <Select
                    value={newIncome.frequency || "monthly"}
                    onValueChange={(value) => setNewIncome({ ...newIncome, frequency: value })}
                  >
                    <SelectTrigger className="border-input bg-background text-foreground">
                      <SelectValue placeholder="Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addIncomeSource}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Income Source
                </Button>
              </div>

              <div className="rounded-lg bg-primary/5 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> You may be asked to upload proof of income 
                  (paystubs, tax returns, etc.) in the next step.
                </p>
              </div>
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Asset Information</CardTitle>
              <CardDescription>
                This section may apply if you or a household member is over 65 or applying for Long-Term Care
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-foreground">Do you have assets to report?</Label>
                <RadioGroup
                  value={formData.hasAssets}
                  onValueChange={(value) => setFormData({ ...formData, hasAssets: value })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 rounded-lg border border-border p-4 hover:bg-secondary/30">
                    <RadioGroupItem value="no" id="no-assets" />
                    <Label htmlFor="no-assets" className="flex-1 cursor-pointer text-foreground">
                      No, I do not have assets to report
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border border-border p-4 hover:bg-secondary/30">
                    <RadioGroupItem value="yes" id="yes-assets" />
                    <Label htmlFor="yes-assets" className="flex-1 cursor-pointer text-foreground">
                      Yes, I have assets to report
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.hasAssets === "yes" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankAccounts" className="text-foreground">
                      Bank Accounts (Total Value)
                    </Label>
                    <Input
                      id="bankAccounts"
                      placeholder="$0.00"
                      value={formData.bankAccounts}
                      onChange={(e) => setFormData({ ...formData, bankAccounts: e.target.value })}
                      className="border-input bg-background text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="investments" className="text-foreground">
                      Investments (Stocks, Bonds, 401k, etc.)
                    </Label>
                    <Input
                      id="investments"
                      placeholder="$0.00"
                      value={formData.investments}
                      onChange={(e) => setFormData({ ...formData, investments: e.target.value })}
                      className="border-input bg-background text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property" className="text-foreground">
                      Real Estate (Other than primary residence)
                    </Label>
                    <Input
                      id="property"
                      placeholder="$0.00"
                      value={formData.property}
                      onChange={(e) => setFormData({ ...formData, property: e.target.value })}
                      className="border-input bg-background text-foreground"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Document Upload</CardTitle>
              <CardDescription>
                Upload required documents to verify your information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Document Upload Areas */}
                {[
                  { id: "id", title: "Photo ID", desc: "Driver's license, passport, or state ID" },
                  { id: "income", title: "Proof of Income", desc: "Recent paystubs or tax returns" },
                  { id: "residency", title: "Proof of Residency", desc: "Utility bill, lease, or bank statement" },
                  { id: "immigration", title: "Immigration Documents", desc: "If applicable, provide immigration documents" },
                ].map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-dashed border-border p-6">
                    <div className="text-center">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <h4 className="mt-2 font-medium text-foreground">{doc.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{doc.desc}</p>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Upload className="h-4 w-4" />
                          Upload File
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2">
                          Use Camera
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-accent/5 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Supported formats:</strong> PDF, JPG, PNG (max 10MB per file).
                  Our AI will automatically extract information from your documents.
                </p>
              </div>
            </CardContent>
          </Card>
        )

      case 6:
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">AI Data Review</CardTitle>
              <CardDescription>
                Review the information extracted from your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Extracted Data Preview */}
              <div className="rounded-lg border border-border">
                <div className="border-b border-border bg-secondary/30 p-4">
                  <h4 className="font-medium text-foreground">Extracted Information</h4>
                  <p className="text-sm text-muted-foreground">
                    Please verify the accuracy of the extracted data
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { field: "Full Name", value: "John Doe", confidence: 98 },
                    { field: "Date of Birth", value: "01/15/1985", confidence: 95 },
                    { field: "Employer", value: "ABC Corporation", confidence: 88 },
                    { field: "Monthly Income", value: "$3,200", confidence: 75 },
                    { field: "Address", value: "123 Main St, Boston, MA 02101", confidence: 92 },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">{item.field}</p>
                        <p className="font-medium text-foreground">{item.value}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.confidence >= 90
                              ? "bg-success/10 text-success"
                              : item.confidence >= 75
                              ? "bg-warning/10 text-warning"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {item.confidence}%
                        </div>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <FileCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Confidence Score Legend</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        <span className="text-muted-foreground">90%+ High</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-warning" />
                        <span className="text-muted-foreground">75-89% Medium</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                        <span className="text-muted-foreground">{"<75%"} Low - Review needed</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 7:
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Review & Submit</CardTitle>
              <CardDescription>
                Review your application before submitting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4">
                  <h4 className="mb-3 font-medium text-foreground">Application Summary</h4>
                  <div className="grid gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Applicant</span>
                      <span className="text-foreground">{formData.firstName} {formData.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Household Size</span>
                      <span className="text-foreground">{formData.householdMembers.length + 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Monthly Income</span>
                      <span className="text-foreground">
                        ${formData.incomeSources.reduce((sum, s) => sum + Number(s.amount || 0), 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Documents Uploaded</span>
                      <span className="text-foreground">{formData.documents.length || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Pre-screening Result */}
                <div className="rounded-lg bg-accent/10 p-4">
                  <h4 className="font-medium text-foreground">Pre-Screening Result</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Based on the information provided, you may qualify for{" "}
                    <strong className="text-accent">MassHealth CarePlus</strong>.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Final determination made by MassHealth after review.
                  </p>
                </div>

                {/* Certification */}
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certify"
                      checked={formData.certify}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, certify: checked as boolean })
                      }
                    />
                    <Label htmlFor="certify" className="text-sm leading-relaxed text-foreground">
                      I certify that all information provided in this application is true and accurate 
                      to the best of my knowledge. I understand that providing false information may 
                      result in denial of benefits or other penalties.
                    </Label>
                  </div>

                  {/* E-Signature */}
                  <div className="space-y-2">
                    <Label className="text-foreground">E-Signature</Label>
                    <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Click or tap here to sign
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={!formData.certify || isGeneratingPdf}
                    onClick={() => {
                      void handleDownloadFilledPdf()
                    }}
                  >
                    <Download className="h-4 w-4" />
                    {isGeneratingPdf ? "Generating Filled ACA PDF..." : "Download Filled ACA PDF"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <WizardLayout
      steps={stepsWithStatus}
      currentStep={currentStep}
      title={steps[currentStep - 1].title}
    >
      {renderStep()}

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          Back
        </Button>
        <Button
          onClick={() => {
            void handleNext()
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={(currentStep === 7 && !formData.certify) || isGeneratingPdf}
        >
          {currentStep === 7 ? (isGeneratingPdf ? "Generating PDF..." : "Submit Application") : "Continue"}
        </Button>
      </div>
    </WizardLayout>
  )
}
