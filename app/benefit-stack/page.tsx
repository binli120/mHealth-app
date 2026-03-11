"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { FamilyProfileWizard } from "@/components/benefit-orchestration/FamilyProfileWizard"
import { BenefitStackView } from "@/components/benefit-orchestration/BenefitStackView"
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
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/customer/dashboard"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-900">Benefit Stack</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Page intro — shown when viewing the wizard */}
        {showWizard && (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
              <span className="text-2xl">🏛️</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Find All Your Benefits</h1>
            <p className="text-gray-500 max-w-lg mx-auto">
              Answer a few questions once and we&apos;ll check your eligibility across all major MA
              safety-net programs — MassHealth, SNAP, EITC, childcare, housing, utilities, and more.
            </p>
          </div>
        )}

        {/* Content */}
        {showWizard ? (
          <FamilyProfileWizard onComplete={handleComplete} />
        ) : stack ? (
          <BenefitStackView stack={stack} onUpdateProfile={handleUpdateProfile} />
        ) : null}
      </main>
    </div>
  )
}
