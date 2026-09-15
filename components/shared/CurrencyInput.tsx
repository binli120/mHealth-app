/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CurrencyInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  description?: string
  placeholder?: string
  id?: string
}

function formatDisplay(value: number): string {
  if (!value) return ""
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Strips input to digits + a single decimal point, formats the whole part with commas. */
function parseInput(raw: string): { display: string; numeric: number } {
  const cleaned = raw.replace(/[^0-9.]/g, "")
  const firstDot = cleaned.indexOf(".")
  const normalized =
    firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "")
  const [whole, decimal] = normalized.split(".")
  const numeric = Math.max(0, Number(normalized) || 0)
  const wholeFormatted = whole ? Number(whole).toLocaleString("en-US") : ""
  const display = decimal !== undefined ? `${wholeFormatted}.${decimal.slice(0, 2)}` : wholeFormatted
  return { display, numeric }
}

/**
 * Dollar-prefixed currency input with live thousands-separator formatting
 * (e.g. "10,000.00"). Shared by FamilyProfileWizard income/housing fields
 * and any future money-entry forms.
 */
export function CurrencyInput({
  label,
  value,
  onChange,
  description,
  placeholder = "0.00",
  id,
}: CurrencyInputProps) {
  // Holds the live text only while the user is actively editing; null means
  // "derive from value", so the field always reflects the latest prop once blurred.
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? formatDisplay(value)

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-gray-700">
        {label}
      </Label>
      {description && <p className="text-xs text-gray-400">{description}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={display}
          onFocus={() => setDraft(display)}
          onChange={(e) => {
            const { display: nextDisplay, numeric } = parseInput(e.target.value)
            setDraft(nextDisplay)
            onChange(numeric)
          }}
          onBlur={() => setDraft(null)}
          className="pl-7 text-sm"
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
