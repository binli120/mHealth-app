/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Deterministic tool for the MassHealth Specialist Agent.
 *
 * Wraps the existing evaluateMassHealth() + evaluateMSP() program evaluators
 * so the LLM can call them as a tool rather than running them directly.
 */

import "server-only"

import { tool } from "ai"
import { z } from "zod"

import { evaluateMassHealth } from "@/lib/benefit-orchestration/programs/masshealth"
import { evaluateMSP } from "@/lib/benefit-orchestration/programs/msp"
import type { FamilyProfile, BenefitResult } from "@/lib/benefit-orchestration/types"
import { getIncomeAsFPLPercent, computeTotalMonthlyIncome } from "@/lib/benefit-orchestration/fpl-utils"

export function buildMassHealthSpecialistTools(profile: FamilyProfile, fplPercent: number) {
  return {
    evaluate_masshealth_tracks: tool({
      description:
        "Run the deterministic MassHealth eligibility evaluator across all coverage tracks " +
        "(Standard, CarePlus, Limited, Family Assistance/CHIP, Pregnancy, ConnectorCare, " +
        "Health Connector credits) and the Medicare Savings Program. " +
        "Returns all applicable tracks with eligibility status and estimated monthly value.",
      inputSchema: z.object({}),
      execute: async (): Promise<{ tracks: BenefitResult[]; fplPercent: number; totalMonthlyIncome: number }> => {
        const masshealthTracks = evaluateMassHealth(profile, fplPercent)
        const mspResult = evaluateMSP(profile, fplPercent)

        const tracks: BenefitResult[] = [
          ...masshealthTracks,
          ...(mspResult ? [mspResult] : []),
        ]

        return {
          tracks,
          fplPercent,
          totalMonthlyIncome: computeTotalMonthlyIncome(profile),
        }
      },
    }),
  }
}
