/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats raw input into (xxx) xxx-xxxx as the user types.
 * Non-digit characters are stripped; output is clamped to 10 digits.
 */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10)
  if (digits.length === 0) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Returns an error message when the value has some digits but fewer than 10.
 * Returns null when the value is empty (field is optional) or complete.
 */
function validatePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 0) return null
  return digits.length === 10 ? null : "Enter a 10-digit US phone number."
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhoneInputProps {
  /** HTML id for the input — ties the Label for accessibility. Defaults to "phone". */
  id?: string
  /** Visible label text. When omitted the label row is not rendered. */
  label?: string
  /**
   * Controlled value — may be raw digits, any formatted phone string, or empty.
   * The component always displays it in (xxx) xxx-xxxx form.
   */
  value: string
  /** Called with the (xxx) xxx-xxxx formatted string on every keystroke. */
  onChange: (formatted: string) => void
  onBlur?: () => void
  /**
   * External error message from a parent form (e.g. on submit validation).
   * Takes precedence over the component's own blur-triggered validation.
   */
  error?: string | null
  disabled?: boolean
  placeholder?: string
  className?: string
  required?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Controlled phone number input with automatic (xxx) xxx-xxxx formatting and
 * inline validation on blur.  Shared across profile forms and any other place
 * a standalone phone field is needed.
 *
 * - Formats progressively as the user types — no library needed.
 * - Validates on blur: shows an error when the number is incomplete.
 * - Empty values are accepted (the field is treated as optional unless `required`
 *   is set and the parent handles that constraint).
 * - An external `error` prop (e.g. from a parent's submit handler) overrides
 *   the inline validation message.
 */
export function PhoneInput({
  id = "phone",
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder = "(617) 555-0100",
  className,
  required = false,
}: PhoneInputProps) {
  // Only show inline validation after the user has left the field at least once.
  const [touched, setTouched] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatPhone(e.target.value))
  }

  const handleBlur = () => {
    setTouched(true)
    onBlur?.()
  }

  const inlineError = touched ? validatePhone(value) : null
  // External error from parent takes precedence; fall back to inline blur error.
  const visibleError = error ?? inlineError

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden>
              *
            </span>
          )}
        </Label>
      )}
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        // Always display in (xxx) xxx-xxxx form so pasted raw digits or values
        // saved in a previous format are normalized immediately.
        value={formatPhone(value)}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(visibleError)}
        aria-describedby={visibleError ? `${id}-error` : undefined}
        className={cn(visibleError && "border-destructive focus-visible:ring-destructive")}
      />
      {visibleError && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {visibleError}
        </p>
      )}
    </div>
  )
}
