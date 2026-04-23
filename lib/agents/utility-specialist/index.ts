/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { generateObject } from "ai"
import { z } from "zod"

import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { evaluateLIHEAP } from "@/lib/benefit-orchestration/programs/liheap"
import {
  computeDerivedFields,
  getIncomeAsFPLPercent,
  computeTotalMonthlyIncome,
} from "@/lib/benefit-orchestration/fpl-utils"
import type { FamilyProfile, BenefitResult } from "@/lib/benefit-orchestration/types"
import { buildUtilitySpecialistPrompt } from "./prompts"

export interface UtilitySpecialistResult {
  results: BenefitResult[]
  reasoning: string
}

type RawProfile = Parameters<typeof computeDerivedFields>[0] &
  Partial<Pick<FamilyProfile, "householdSize" | "childrenUnder5" | "childrenUnder13" | "childrenUnder18" | "childrenUnder19">>

export async function callUtilitySpecialist(rawProfile: RawProfile): Promise<UtilitySpecialistResult> {
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const fplPercent = getIncomeAsFPLPercent(totalMonthlyIncome * 12, profile.householdSize)

  const liheapResult = evaluateLIHEAP(profile, fplPercent)
  const deterministicResults = [liheapResult].filter((r): r is BenefitResult => r !== null)

  try {
    const { object } = await generateObject({
      model: getOllamaModel(),
      system: buildUtilitySpecialistPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            householdSnapshot: {
              householdSize: profile.householdSize,
              housingStatus: profile.housingStatus,
              utilityTypes: profile.utilityTypes,
              disabled: profile.disabled,
              over65: profile.over65,
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
        liheapReasoning: z.string(),
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
      reasoning: "Utility assistance evaluated using the deterministic rule engine.",
    }
  }
}
