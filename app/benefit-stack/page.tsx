/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useState, useCallback } from "react"

import { FamilyProfileWizard } from "@/components/benefit-orchestration/FamilyProfileWizard"
import { BenefitStackView } from "@/components/benefit-orchestration/BenefitStackView"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageIntro } from "@/components/shared/PageIntro"
import type { BenefitStack } from "@/lib/benefit-orchestration/types"
import { getMessage } from "@/lib/i18n/messages"
import { useAppSelector } from "@/lib/redux/hooks"

export default function BenefitStackPage() {
  const language = useAppSelector((state) => state.app.language)
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
        backLabel={getMessage(language, "bsDashboardLink")}
        breadcrumbs={[{ label: getMessage(language, "bsBenefitStackLink") }]}
      />

      <main className="mx-auto max-w-4xl px-4 py-8">
        {showWizard && (
          <PageIntro
            icon={<span className="text-2xl">🏛️</span>}
            iconBg="bg-blue-100"
            title={getMessage(language, "bsPageTitle")}
            description={getMessage(language, "bsPageDesc")}
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
