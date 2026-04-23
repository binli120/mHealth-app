/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * MassHealth Specialist Agent entry point.
 *
 * Pattern: deterministic evaluation first, then LLM adds reasoning.
 *   1. evaluateMassHealth() + evaluateMSP() run synchronously → BenefitResult[]
 *   2. generateObject() receives the results and the household snapshot, then
 *      returns plain-language reasoning and any edge-case flags.
 *
 * Falls back to deterministic-only results if the LLM is unavailable.
 * Called by the benefit orchestrator in parallel with other specialist agents.
 */

import "server-only"

import { generateObject } from "ai"
import { z } from "zod"

import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import { evaluateMassHealth } from "@/lib/benefit-orchestration/programs/masshealth"
import { evaluateMSP } from "@/lib/benefit-orchestration/programs/msp"
import {
  computeDerivedFields,
  getIncomeAsFPLPercent,
  getAnnualFPL,
  computeTotalMonthlyIncome,
} from "@/lib/benefit-orchestration/fpl-utils"
import type { FamilyProfile, BenefitResult } from "@/lib/benefit-orchestration/types"
import { buildMassHealthSpecialistPrompt } from "./prompts"

export interface MassHealthSpecialistResult {
  results: BenefitResult[]
  reasoning: string
}

type RawProfile = Parameters<typeof computeDerivedFields>[0] &
  Partial<
    Pick<
      FamilyProfile,
      | "householdSize"
      | "childrenUnder5"
      | "childrenUnder13"
      | "childrenUnder18"
      | "childrenUnder19"
    >
  >

/**
 * Run the MassHealth Specialist Agent against a household profile.
 *
 * Returns deterministic BenefitResult[] augmented with LLM reasoning.
 * Falls back gracefully to deterministic-only when Ollama is unavailable.
 */
export async function callMassHealthSpecialist(rawProfile: RawProfile): Promise<MassHealthSpecialistResult> {
  const derived = computeDerivedFields(rawProfile)
  const profile: FamilyProfile = { ...rawProfile, ...derived }

  const totalMonthlyIncome = computeTotalMonthlyIncome(profile)
  const annualIncome = totalMonthlyIncome * 12
  const fplPercent = getIncomeAsFPLPercent(annualIncome, profile.householdSize)

  // Step 1: run deterministic evaluators (always succeeds).
  const mhTracks = evaluateMassHealth(profile, fplPercent)
  const mspResult = evaluateMSP(profile, fplPercent)
  const deterministicResults: BenefitResult[] = [
    ...mhTracks,
    ...(mspResult ? [mspResult] : []),
  ]

  // Step 2: ask the LLM to reason about the results and flag edge cases.
  try {
    const { object } = await generateObject({
      model: getOllamaModel(),
      system: buildMassHealthSpecialistPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            householdSnapshot: {
              age: profile.age,
              pregnant: profile.pregnant,
              disabled: profile.disabled,
              over65: profile.over65,
              hasMedicare: profile.hasMedicare,
              citizenshipStatus: profile.citizenshipStatus,
              stateResident: profile.stateResident,
              householdSize: profile.householdSize,
              fplPercent,
              totalMonthlyIncome,
            },
            tracks: deterministicResults.map((r) => ({
              programId: r.programId,
              programName: r.programName,
              eligibilityStatus: r.eligibilityStatus,
              confidence: r.confidence,
              estimatedMonthlyValue: r.estimatedMonthlyValue,
              keyRequirements: r.keyRequirements,
            })),
          }),
        },
      ],
      schema: z.object({
        trackReasoning: z.array(
          z.object({
            programId: z.string(),
            reasoning: z.string(),
          }),
        ),
        overallReasoning: z.string(),
      }),
    })

    // Merge per-track reasoning back onto the deterministic BenefitResult objects.
    const resultsWithReasoning = deterministicResults.map((track) => {
      const llm = object.trackReasoning.find((r) => r.programId === track.programId)
      return llm?.reasoning ? { ...track, reasoning: llm.reasoning } : track
    })

    return {
      results: resultsWithReasoning,
      reasoning: object.overallReasoning,
    }
  } catch {
    return {
      results: deterministicResults,
      reasoning:
        "MassHealth tracks evaluated using the deterministic rule engine. " +
        "Edge case analysis unavailable — verify borderline eligibility with MassHealth directly.",
    }
  }
}
