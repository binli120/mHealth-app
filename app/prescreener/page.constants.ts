/**
 * Conversation flow lookup helpers for the Pre-Screener page.
 * @author Bin Lee
 */

import { type SupportedLanguage } from "@/lib/i18n/languages"
import type { Step } from "./page.types"
import { getPrescreenerSteps } from "./prescreener-copy"

export function getStepMap(language: SupportedLanguage): Record<string, Step> {
  return Object.fromEntries(getPrescreenerSteps(language).map((step) => [step.id, step]))
}

export const PROGRESS_STEPS = [
  "intro",
  "age",
  "household_size",
  "income",
  "citizenship",
  "disability",
  "employer_insurance",
  "done",
]
