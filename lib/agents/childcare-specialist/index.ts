/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { generateObject } from "ai"
import { z } from "zod"

import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { evaluateChildcare } from "@/lib/benefit-orchestration/programs/childcare"
import {
  computeDerivedFields,
  getIncomeAsFPLPercent,
  computeTotalMonthlyIncome,
} from "@/lib/benefit-orchestration/fpl-utils"
import type { FamilyProfile, BenefitResult } from "@/lib/benefit-orchestration/types"
import { buildChildcareSpecialistPrompt } from "./prompts"

export interface ChildcareSpecialistResult {
  results: BenefitResult[]
  reasoning: string
}

type RawProfile = Parameters<typeof computeDerivedFields>[0] &
  Partial<Pick<FamilyProfile, "householdSize" | "childrenUnder5" | "childrenUnder13" | "childrenUnder18" | "childrenUnder19">>

export async function callChildcareSpecialist(rawProfile: RawProfile): Promise<ChildcareSpecialistResult> {
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const fplPercent = getIncomeAsFPLPercent(totalMonthlyIncome * 12, profile.householdSize)

  const childcareResult = evaluateChildcare(profile, fplPercent)
  const deterministicResults = [childcareResult].filter((r): r is BenefitResult => r !== null)

  try {
    const { object } = await generateObject({
      model: getOllamaModel(),
      system: buildChildcareSpecialistPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            householdSnapshot: {
              householdSize: profile.householdSize,
              employmentStatus: profile.employmentStatus,
              childrenUnder5: profile.childrenUnder5,
              childrenUnder13: profile.childrenUnder13,
              fplPercent,
              totalMonthlyIncome,
              hasSelfEmployment: profile.income.selfEmployment > 0,
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
        childcareReasoning: z.string(),
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
      reasoning: "Childcare assistance evaluated using the deterministic rule engine.",
    }
  }
}
