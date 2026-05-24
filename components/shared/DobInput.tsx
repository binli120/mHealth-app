/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive whole-year age from a Date object (local-time safe). */
function computeAge(dob: Date): number {
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return Math.max(0, age)
}

/** ISO YYYY-MM-DD → MM/DD/YYYY display string. */
function isoToDisplay(iso: string): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return ""
  return `${m}/${d}/${y}`
}

/**
 * Auto-format raw keyboard input to MM/DD/YYYY by inserting slashes
 * after the 2nd and 4th digit as the user types.
 */
function formatTyped(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * Parse a fully-typed MM/DD/YYYY string to ISO YYYY-MM-DD.
 * Returns null if the date is incomplete, invalid, or in the future.
 */
function displayToIso(display: string): string | null {
  const digits = display.replace(/\D/g, "")
  if (digits.length !== 8) return null
  const mo = parseInt(digits.slice(0, 2), 10)
  const dy = parseInt(digits.slice(2, 4), 10)
  const yr = parseInt(digits.slice(4), 10)
  if (mo < 1 || mo > 12 || dy < 1 || dy > 31 || yr < 1) return null
  // Local-time construction avoids UTC off-by-one-day timezone bug
  const date = new Date(yr, mo - 1, dy)
  if (date > new Date()) return null
  // Validate real calendar day (e.g. Feb 30 overflows)
  if (date.getMonth() !== mo - 1 || date.getDate() !== dy) return null
  return `${yr}-${String(mo).padStart(2, "0")}-${String(dy).padStart(2, "0")}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface DobInputProps {
  /** HTML id forwarded to the text input (for Label association). */
  id?: string
  /** Optional label rendered above the input row. */
  label?: string
  labelClassName?: string
  /**
   * Controlled value as an ISO date string (YYYY-MM-DD) or empty string.
   * The component derives the MM/DD/YYYY display from this.
   */
  value: string
  /**
   * Called whenever a complete, valid date is entered (either by typing or
   * calendar selection). Receives the ISO string and the computed age in years.
   */
  onChange: (isoDate: string, age: number) => void
  disabled?: boolean
  className?: string
}

export function DobInput({ id, label, labelClassName, value, onChange, disabled, className }: DobInputProps) {
  const inputId = id ?? "dob-input"
  const errorId = `${inputId}-error`

  // The text shown in the <input> — kept as MM/DD/YYYY while typing
  const [textValue, setTextValue] = useState(() => isoToDisplay(value))
  const [calOpen, setCalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  // Derived-state sync (React docs pattern — avoids both setState-in-effect
  // and ref-read-during-render):
  //
  // When the parent changes `value` (e.g. a form reset), update the display
  // text to match. We don't need to guard against "parent echoes our own
  // onChange" because that echo is always a no-op: after emitting iso X, the
  // parent passes X back, isoToDisplay(X) equals the current textValue, and
  // React bails out on the identical setState before any re-render occurs.
  //
  // Calling setState during render is safe here because it is guarded by a
  // changed-prop check; React throws away the current render and immediately
  // restarts with the new state in the same synchronous pass.
  const [prevExternalValue, setPrevExternalValue] = useState(value)
  if (value !== prevExternalValue) {
    setPrevExternalValue(value)
    setTextValue(isoToDisplay(value))
    setError(null)
  }

  function emit(iso: string, date: Date) {
    onChange(iso, computeAge(date))
  }

  function handleTextChange(raw: string) {
    const formatted = formatTyped(raw)
    setTextValue(formatted)
    setError(null)

    // Emit as soon as all 8 digits are entered and the date is valid
    const iso = displayToIso(formatted)
    if (iso) {
      const [yr, mo, dy] = iso.split("-").map(Number)
      emit(iso, new Date(yr, mo - 1, dy))
    }
  }

  function handleBlur() {
    setTouched(true)
    if (!textValue) {
      setError(null)
      return
    }
    const digits = textValue.replace(/\D/g, "")
    if (digits.length > 0 && digits.length < 8) {
      setError("Enter a complete date (MM/DD/YYYY)")
      return
    }
    if (digits.length === 8) {
      setError(displayToIso(textValue) ? null : "Invalid date")
    }
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (!date) return
    const yr = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, "0")
    const dy = String(date.getDate()).padStart(2, "0")
    const iso = `${yr}-${mo}-${dy}`
    setTextValue(`${mo}/${dy}/${yr}`)
    setError(null)
    setCalOpen(false)
    emit(iso, date)
  }

  // Parse current ISO for Calendar's `selected` prop (local-time safe)
  const selectedDate = value
    ? (() => {
        const [yr, mo, dy] = value.split("-").map(Number)
        return new Date(yr, mo - 1, dy)
      })()
    : undefined

  const showError = touched && !!error

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label htmlFor={inputId} className={cn("text-sm", labelClassName)}>
          {label}
        </Label>
      )}

      <div className="flex gap-1.5">
        {/* Typed input — auto-formats MM/DD/YYYY as digits are entered */}
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          placeholder="MM/DD/YYYY"
          value={textValue}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          disabled={disabled}
          maxLength={10}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          className={cn("flex-1", showError && "border-destructive focus-visible:ring-destructive")}
        />

        {/* Calendar picker button */}
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              className="h-10 w-10 shrink-0"
              aria-label="Open calendar to pick date of birth"
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              captionLayout="dropdown"
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              startMonth={new Date(new Date().getFullYear() - 120, 0, 1)}
              endMonth={new Date()}
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>

      {showError && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
