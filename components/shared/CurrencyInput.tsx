/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

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

/**
 * Dollar-prefixed numeric input for currency amounts.
 * Shared by FamilyProfileWizard income/asset sections and any future forms.
 */
export function CurrencyInput({
  label,
  value,
  onChange,
  description,
  placeholder = "0",
  id,
}: CurrencyInputProps) {
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
          type="number"
          min={0}
          step={1}
          value={value || ""}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="pl-7 text-sm"
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
