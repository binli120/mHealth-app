/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { generateObject } from "ai"
import { z } from "zod"

import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { evaluateSection8 } from "@/lib/benefit-orchestration/programs/section8"
import {
  computeDerivedFields,
  getIncomeAsFPLPercent,
  computeTotalMonthlyIncome,
} from "@/lib/benefit-orchestration/fpl-utils"
import type { FamilyProfile, BenefitResult } from "@/lib/benefit-orchestration/types"
import { buildHousingSpecialistPrompt } from "./prompts"

export interface HousingSpecialistResult {
  results: BenefitResult[]
  reasoning: string
}

type RawProfile = Parameters<typeof computeDerivedFields>[0] &
  Partial<Pick<FamilyProfile, "householdSize" | "childrenUnder5" | "childrenUnder13" | "childrenUnder18" | "childrenUnder19">>

export async function callHousingSpecialist(rawProfile: RawProfile): Promise<HousingSpecialistResult> {
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const fplPercent = getIncomeAsFPLPercent(totalMonthlyIncome * 12, profile.householdSize)

  const section8Result = evaluateSection8(profile, fplPercent)
  const deterministicResults = [section8Result].filter((r): r is BenefitResult => r !== null)

  try {
    const { object } = await generateObject({
      model: getOllamaModel(),
      system: buildHousingSpecialistPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            householdSnapshot: {
              householdSize: profile.householdSize,
              housingStatus: profile.housingStatus,
              disabled: profile.disabled,
              over65: profile.over65,
              pregnant: profile.pregnant,
              county: profile.county,
              fplPercent,
              totalMonthlyIncome,
            },
            programs: deterministicResults.map((r) => ({
              programId: r.programId,
              eligibilityStatus: r.eligibilityStatus,
              confidence: r.confidence,
              estimatedMonthlyValue: r.estimatedMonthlyValue,
              waitlistWarning: r.waitlistWarning,
            })),
          }),
        },
      ],
      schema: z.object({
        section8Reasoning: z.string(),
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
      reasoning: "Housing assistance evaluated using the deterministic rule engine.",
    }
  }
}
