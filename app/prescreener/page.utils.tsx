/**
 * Utility functions for the Pre-Screener page.
 * @author Bin Lee
 */

import { AlertCircle, CheckCircle2, HelpCircle, Info } from "lucide-react"
import type { EligibilityColor } from "@/lib/eligibility-engine"
import { PROGRESS_STEPS } from "./page.constants"

export function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function colorConfig(color: EligibilityColor, label: string) {
  switch (color) {
    case "green":
      return {
        bg: "bg-emerald-50 border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800",
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
        label,
      }
    case "yellow":
      return {
        bg: "bg-amber-50 border-amber-200",
        badge: "bg-amber-100 text-amber-800",
        icon: <HelpCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />,
        label,
      }
    case "red":
      return {
        bg: "bg-red-50 border-red-200",
        badge: "bg-red-100 text-red-800",
        icon: <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />,
        label,
      }
    case "blue":
      return {
        bg: "bg-blue-50 border-blue-200",
        badge: "bg-blue-100 text-blue-800",
        icon: <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />,
        label,
      }
    default:
      return {
        bg: "bg-secondary border-border",
        badge: "bg-muted text-muted-foreground",
        icon: <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />,
        label,
      }
  }
}

export function getProgress(stepId: string): number {
  const idx = PROGRESS_STEPS.indexOf(stepId)
  if (idx < 0) return 0
  return Math.round((idx / (PROGRESS_STEPS.length - 1)) * 100)
}
