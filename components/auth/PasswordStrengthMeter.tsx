/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Inline password strength meter shown below the password input.
 * Displays a segmented bar + individual rule checklist.
 */

"use client"

import { Check, X } from "lucide-react"
import { type PasswordStrength } from "@/lib/auth/password-strength"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import type { PasswordCopy } from "@/app/auth/register/register-copy"

interface PasswordStrengthMeterProps {
  strength: PasswordStrength
  language?: SupportedLanguage
  copy: PasswordCopy
}

const SEGMENT_COLORS: Record<string, string> = {
  empty:  "bg-muted",
  weak:   "bg-red-500",
  fair:   "bg-amber-400",
  good:   "bg-blue-500",
  strong: "bg-emerald-500",
}

const LABEL_COLORS: Record<string, string> = {
  empty:  "text-muted-foreground",
  weak:   "text-red-600",
  fair:   "text-amber-600",
  good:   "text-blue-600",
  strong: "text-emerald-600",
}

export function PasswordStrengthMeter({ strength, copy }: PasswordStrengthMeterProps) {
  if (strength.level === "empty") return null

  const activeColor = SEGMENT_COLORS[strength.level]
  const labelColor  = LABEL_COLORS[strength.level]

  return (
    <div className="space-y-2 pt-0.5">
      {/* Segmented strength bar */}
      <div className="flex items-center gap-1.5">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={[
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i < strength.score ? activeColor : "bg-muted",
              ].join(" ")}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${labelColor} w-14 text-right`}>
          {copy.strengthLabels[strength.level]}
        </span>
      </div>

      {/* Requirement checklist */}
      <ul className="space-y-0.5">
        {strength.rules.map((rule) => (
          <li key={rule.key} className="flex items-center gap-1.5">
            {rule.met
              ? <Check className="h-3 w-3 text-emerald-500 shrink-0" />
              : <X     className="h-3 w-3 text-muted-foreground shrink-0" />
            }
            <span className={`text-xs ${rule.met ? "text-foreground" : "text-muted-foreground"}`}>
              {copy.rules[rule.key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
