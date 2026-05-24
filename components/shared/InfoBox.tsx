/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type InfoBoxVariant = "info" | "warning" | "success" | "error" | "neutral"

const VARIANT_CLASSES: Record<InfoBoxVariant, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error: "bg-red-50 border-red-200 text-red-700",
  neutral: "bg-gray-50 border-gray-200 text-gray-600",
}

interface InfoBoxProps {
  variant?: InfoBoxVariant
  children: ReactNode
  className?: string
  /** ARIA role — use "alert" for error messages that should be announced immediately. */
  role?: string
  /** ARIA live region politeness. Defaults to "off"; "assertive" is set automatically when role="alert". */
  "aria-live"?: "off" | "polite" | "assertive"
  /** ARIA label for the box (e.g. to give it a name when role="alert"). */
  "aria-label"?: string
}

/**
 * Colored info/note/warning box.
 * Replaces the repeated inline `rounded-lg bg-amber-50 border border-amber-200` pattern.
 *
 * Pass `role="alert"` on error variants so screen readers announce the message immediately.
 *
 * @example
 * <InfoBox variant="warning">Important: these are estimates only.</InfoBox>
 * <InfoBox variant="error" role="alert">Something went wrong.</InfoBox>
 * <InfoBox variant="neutral" className="text-xs">Note: primary home not counted.</InfoBox>
 */
export function InfoBox({ variant = "neutral", children, className, role, ...aria }: InfoBoxProps) {
  return (
    <div
      role={role}
      {...aria}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </div>
  )
}
