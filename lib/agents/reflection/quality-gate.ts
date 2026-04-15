/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Reflection quality gates for user-facing agent prose.
 *
 * These helpers run a structured self-review pass before generated appeal
 * letters or eligibility explanations are committed to the response stream.
 */

import "server-only"

import { generateText, Output } from "ai"
import { z } from "zod"

import { getOllamaModel } from "@/lib/masshealth/ollama-provider"
import type { SupportedLanguage } from "@/lib/i18n/languages"

// ── Schemas ──────────────────────────────────────────────────────────────────

const appealReviewSchema = z.object({
  factuallyAccurate: z.boolean(),
  clearToLayperson: z.boolean(),
  hasSpecificEvidence: z.boolean(),
  issues: z.array(z.string()).max(10),
  revisedLetter: z.string().optional(),
})

const eligibilityReviewSchema = z.object({
  factuallyAccurate: z.boolean(),
  clearToLayperson: z.boolean(),
  hasSpecificEvidence: z.boolean(),
  issues: z.array(z.string()).max(10),
  revisedExplanation: z.string().optional(),
})

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReflectionReview {
  reviewed: boolean
  factuallyAccurate: boolean
  clearToLayperson: boolean
  hasSpecificEvidence: boolean
  issues: string[]
}

export interface QualityGateResult {
  finalText: string
  review: ReflectionReview
}

interface AppealQualityGateInput {
  appealLetter: string
  explanation: string
  evidenceChecklist: string[]
  policyContext: string
}

interface EligibilityQualityGateInput {
  explanation: string
  eligibilityContext: string
  policyContext: string
  language: SupportedLanguage
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fallbackReview(issue: string): ReflectionReview {
  return {
    reviewed: false,
    factuallyAccurate: false,
    clearToLayperson: false,
    hasSpecificEvidence: false,
    issues: [issue],
  }
}

function normaliseIssues(issues: string[]): string[] {
  return issues.map((issue) => issue.trim()).filter(Boolean).slice(0, 10)
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function reviewAppealLetterQuality(
  input: AppealQualityGateInput,
): Promise<QualityGateResult> {
  try {
    const result = await generateText({
      model: getOllamaModel(),
      output: Output.object({ schema: appealReviewSchema }),
      temperature: 0,
      abortSignal: AbortSignal.timeout(20_000),
      prompt: [
        "You are a MassHealth appeals expert reviewing a draft appeal letter before it reaches a user.",
        "Evaluate factual accuracy, plain-language clarity, and whether the letter includes specific evidence tied to the denial.",
        "Only use the policy context, explanation, evidence checklist, and draft letter below.",
        "If the draft has any material issue, provide a complete revised letter. Do not invent regulations or facts.",
        "",
        `Policy context:\n${input.policyContext || "No retrieved policy context was available."}`,
        "",
        `Plain-language explanation:\n${input.explanation}`,
        "",
        `Evidence checklist:\n${input.evidenceChecklist.map((item) => `- ${item}`).join("\n")}`,
        "",
        `Draft appeal letter:\n${input.appealLetter}`,
      ].join("\n"),
    })

    const review = result.output
    const revised = review.revisedLetter?.trim()

    return {
      finalText: revised || input.appealLetter,
      review: {
        reviewed: true,
        factuallyAccurate: review.factuallyAccurate,
        clearToLayperson: review.clearToLayperson,
        hasSpecificEvidence: review.hasSpecificEvidence,
        issues: normaliseIssues(review.issues),
      },
    }
  } catch {
    return {
      finalText: input.appealLetter,
      review: fallbackReview("Reflection quality gate unavailable; original appeal letter returned unchanged."),
    }
  }
}

export async function reviewEligibilityExplanationQuality(
  input: EligibilityQualityGateInput,
): Promise<QualityGateResult> {
  try {
    const result = await generateText({
      model: getOllamaModel(),
      output: Output.object({ schema: eligibilityReviewSchema }),
      temperature: 0,
      abortSignal: AbortSignal.timeout(20_000),
      prompt: [
        "You are a MassHealth eligibility expert reviewing a user-facing eligibility explanation before it reaches a user.",
        `The final explanation must remain in this language code: ${input.language}.`,
        "Evaluate factual accuracy against the deterministic eligibility result, clarity for a layperson, and whether the explanation cites specific facts or program evidence.",
        "Only use the deterministic eligibility context, policy context, and draft explanation below.",
        "If the draft has any material issue, provide a complete revised explanation. Do not invent eligibility rules.",
        "",
        `Deterministic eligibility context:\n${input.eligibilityContext || "No deterministic eligibility context was available."}`,
        "",
        `Policy context:\n${input.policyContext || "No retrieved policy context was available."}`,
        "",
        `Draft eligibility explanation:\n${input.explanation}`,
      ].join("\n"),
    })

    const review = result.output
    const revised = review.revisedExplanation?.trim()

    return {
      finalText: revised || input.explanation,
      review: {
        reviewed: true,
        factuallyAccurate: review.factuallyAccurate,
        clearToLayperson: review.clearToLayperson,
        hasSpecificEvidence: review.hasSpecificEvidence,
        issues: normaliseIssues(review.issues),
      },
    }
  } catch {
    return {
      finalText: input.explanation,
      review: fallbackReview("Reflection quality gate unavailable; original eligibility explanation returned unchanged."),
    }
  }
}
