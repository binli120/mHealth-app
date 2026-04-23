/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { generateObject } from "ai"
import { z } from "zod"

import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { evaluateTAFDC } from "@/lib/benefit-orchestration/programs/tafdc"
import { evaluateEAEDC } from "@/lib/benefit-orchestration/programs/eaedc"
import {
  computeDerivedFields,
  getIncomeAsFPLPercent,
  computeTotalMonthlyIncome,
} from "@/lib/benefit-orchestration/fpl-utils"
import type { FamilyProfile, BenefitResult } from "@/lib/benefit-orchestration/types"
import { buildCashAssistanceSpecialistPrompt } from "./prompts"

export interface CashAssistanceSpecialistResult {
  results: BenefitResult[]
  reasoning: string
}

type RawProfile = Parameters<typeof computeDerivedFields>[0] &
  Partial<Pick<FamilyProfile, "householdSize" | "childrenUnder5" | "childrenUnder13" | "childrenUnder18" | "childrenUnder19">>

export async function callCashAssistanceSpecialist(rawProfile: RawProfile): Promise<CashAssistanceSpecialistResult> {
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const fplPercent = getIncomeAsFPLPercent(totalMonthlyIncome * 12, profile.householdSize)

  const tafdcResult = evaluateTAFDC(profile, fplPercent)
  const aeadcResult = evaluateEAEDC(profile, fplPercent)
  const deterministicResults = [tafdcResult, aeadcResult].filter((r): r is BenefitResult => r !== null)

  try {
    const { object } = await generateObject({
      model: getOllamaModel(),
      system: buildCashAssistanceSpecialistPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            householdSnapshot: {
              age: profile.age,
              disabled: profile.disabled,
              over65: profile.over65,
              pregnant: profile.pregnant,
              citizenshipStatus: profile.citizenshipStatus,
              employmentStatus: profile.employmentStatus,
              householdSize: profile.householdSize,
              childrenUnder18: profile.childrenUnder18,
              fplPercent,
              totalMonthlyIncome,
            },
            programs: deterministicResults.map((r) => ({
              programId: r.programId,
              eligibilityStatus: r.eligibilityStatus,
              confidence: r.confidence,
              estimatedMonthlyValue: r.estimatedMonthlyValue,
            })),
          }),
        },
      ],
      schema: z.object({
        tafdcReasoning: z.string(),
        aeadcReasoning: z.string(),
        overallReasoning: z.string(),
      }),
    })

    return {
      results: deterministicResults,
      reasoning: object.overallReasoning,
    }
  } catch {
    return {
      results: deterministicResults,
      reasoning: "Cash assistance programs evaluated using the deterministic rule engine.",
    }
  }
}
