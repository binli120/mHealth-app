/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { generateObject } from "ai"
import { z } from "zod"

import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { evaluateEITC } from "@/lib/benefit-orchestration/programs/eitc"
import {
  computeDerivedFields,
  getIncomeAsFPLPercent,
  computeTotalMonthlyIncome,
  computeEarnedIncome,
} from "@/lib/benefit-orchestration/fpl-utils"
import type { FamilyProfile, BenefitResult } from "@/lib/benefit-orchestration/types"
import { buildTaxCreditSpecialistPrompt } from "./prompts"

export interface TaxCreditSpecialistResult {
  results: BenefitResult[]
  reasoning: string
}

type RawProfile = Parameters<typeof computeDerivedFields>[0] &
  Partial<Pick<FamilyProfile, "householdSize" | "childrenUnder5" | "childrenUnder13" | "childrenUnder18" | "childrenUnder19">>

export async function callTaxCreditSpecialist(rawProfile: RawProfile): Promise<TaxCreditSpecialistResult> {
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const fplPercent = getIncomeAsFPLPercent(totalMonthlyIncome * 12, profile.householdSize)

  const eitcResult = evaluateEITC(profile, fplPercent)
  const deterministicResults = [eitcResult].filter((r): r is BenefitResult => r !== null)

  try {
    const { object } = await generateObject({
      model: getOllamaModel(),
      system: buildTaxCreditSpecialistPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            householdSnapshot: {
              age: profile.age,
              employmentStatus: profile.employmentStatus,
              filingStatus: profile.filingStatus,
              taxFiler: profile.taxFiler,
              childrenUnder19: profile.childrenUnder19,
              fplPercent,
              totalMonthlyIncome,
              monthlyEarnedIncome: computeEarnedIncome(profile),
              hasSelfEmployment: profile.income.selfEmployment > 0,
              hasSsi: profile.income.ssi > 0,
            },
            programs: deterministicResults.map((r) => ({
              programId: r.programId,
              eligibilityStatus: r.eligibilityStatus,
              confidence: r.confidence,
              estimatedAnnualValue: r.estimatedAnnualValue,
            })),
          }),
        },
      ],
      schema: z.object({
        eitcReasoning: z.string(),
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
      reasoning: "Tax credit eligibility evaluated using the deterministic rule engine.",
    }
  }
}
