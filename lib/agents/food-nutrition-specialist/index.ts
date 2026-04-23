/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { generateObject } from "ai"
import { z } from "zod"

import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { evaluateSnap } from "@/lib/benefit-orchestration/programs/snap"
import { evaluateWIC } from "@/lib/benefit-orchestration/programs/wic"
import {
  computeDerivedFields,
  getIncomeAsFPLPercent,
  computeTotalMonthlyIncome,
} from "@/lib/benefit-orchestration/fpl-utils"
import type { FamilyProfile, BenefitResult } from "@/lib/benefit-orchestration/types"
import { buildFoodNutritionSpecialistPrompt } from "./prompts"

export interface FoodNutritionSpecialistResult {
  results: BenefitResult[]
  reasoning: string
}

type RawProfile = Parameters<typeof computeDerivedFields>[0] &
  Partial<Pick<FamilyProfile, "householdSize" | "childrenUnder5" | "childrenUnder13" | "childrenUnder18" | "childrenUnder19">>

export async function callFoodNutritionSpecialist(rawProfile: RawProfile): Promise<FoodNutritionSpecialistResult> {
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const fplPercent = getIncomeAsFPLPercent(totalMonthlyIncome * 12, profile.householdSize)

  const snapResult = evaluateSnap(profile, fplPercent)
  const wicResult = evaluateWIC(profile, fplPercent)
  const deterministicResults = [snapResult, wicResult].filter((r): r is BenefitResult => r !== null)

  try {
    const { object } = await generateObject({
      model: getOllamaModel(),
      system: buildFoodNutritionSpecialistPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            householdSnapshot: {
              householdSize: profile.householdSize,
              pregnant: profile.pregnant,
              childrenUnder5: profile.childrenUnder5,
              childrenUnder13: profile.childrenUnder13,
              citizenshipStatus: profile.citizenshipStatus,
              fplPercent,
              totalMonthlyIncome,
              assets: profile.assets,
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
        snapReasoning: z.string(),
        wicReasoning: z.string(),
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
      reasoning: "Food & nutrition programs evaluated using the deterministic rule engine.",
    }
  }
}
