"use client"

import { useCallback, useState } from "react"

interface UseStepWizardResult {
  step: number
  goNext: () => void
  goPrev: () => void
  goTo: (index: number) => void
  isFirst: boolean
  isLast: boolean
}

/**
 * Step-navigation state for multi-step wizards.
 *
 * Handles bounds checking (won't go below 0 or above totalSteps - 1).
 *
 * Used by: FamilyProfileWizard, WizardLayout, any future multi-step form.
 *
 * @example
 * const { step, goNext, goPrev, isFirst, isLast } = useStepWizard(STEPS.length)
 *
 * <Button onClick={goPrev} disabled={isFirst}>Back</Button>
 * <Button onClick={goNext} disabled={isLast}>Next</Button>
 */
export function useStepWizard(totalSteps: number, initialStep = 0): UseStepWizardResult {
  const [step, setStep] = useState(initialStep)

  const goNext = useCallback(
    () => setStep((s) => Math.min(s + 1, totalSteps - 1)),
    [totalSteps],
  )

  const goPrev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), [])

  const goTo = useCallback(
    (index: number) => setStep(Math.max(0, Math.min(index, totalSteps - 1))),
    [totalSteps],
  )

  return {
    step,
    goNext,
    goPrev,
    goTo,
    isFirst: step === 0,
    isLast: step === totalSteps - 1,
  }
}
