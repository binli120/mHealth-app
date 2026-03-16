"use client"

import { useState, useCallback } from "react"

import { FamilyProfileWizard } from "@/components/benefit-orchestration/FamilyProfileWizard"
import { BenefitStackView } from "@/components/benefit-orchestration/BenefitStackView"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageIntro } from "@/components/shared/PageIntro"
import type { BenefitStack } from "@/lib/benefit-orchestration/types"

export default function BenefitStackPage() {
  const [stack, setStack] = useState<BenefitStack | null>(null)
  const [showWizard, setShowWizard] = useState(true)

  const handleComplete = useCallback((result: unknown) => {
    setStack(result as BenefitStack)
    setShowWizard(false)
  }, [])

  const handleUpdateProfile = useCallback(() => {
    setShowWizard(true)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backHref="/customer/dashboard"
        backLabel="Dashboard"
        breadcrumbs={[{ label: "Benefit Stack" }]}
      />

      <main className="mx-auto max-w-4xl px-4 py-8">
        {showWizard && (
          <PageIntro
            icon={<span className="text-2xl">🏛️</span>}
            iconBg="bg-blue-100"
            title="Find All Your Benefits"
            description="Answer a few questions once and we'll check your eligibility across all major MA safety-net programs — MassHealth, SNAP, EITC, childcare, housing, utilities, and more."
          />
        )}

        {showWizard ? (
          <FamilyProfileWizard onComplete={handleComplete} />
        ) : stack ? (
          <BenefitStackView stack={stack} onUpdateProfile={handleUpdateProfile} />
        ) : null}
      </main>
    </div>
  )
}
