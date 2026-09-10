/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { validateUsDate } from "@/components/application/aca3/intake-chat-question-builder"
import { cn } from "@/lib/utils"

export type WidgetSpec =
  | { kind: "yes_no" }
  | { kind: "single_select"; options: string[] }
  | { kind: "multi_select"; options: string[]; optional?: boolean }
  | { kind: "date"; noFuture?: boolean }
  | { kind: "phone" }
  | { kind: "ssn" }

interface IntakeQuestionWidgetProps {
  spec: WidgetSpec
  onAnswer: (value: string) => void
  disabled?: boolean
}

function formatPhoneDigits(digits: string): string {
  const d = digits.slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function formatSsnDigits(digits: string): string {
  const d = digits.slice(0, 9)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

function YesNoWidget({ onAnswer, disabled }: { onAnswer: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-9 flex-1 text-sm"
        onClick={() => onAnswer("Yes")}
        disabled={disabled}
      >
        Yes
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-9 flex-1 text-sm"
        onClick={() => onAnswer("No")}
        disabled={disabled}
      >
        No
      </Button>
    </div>
  )
}

function SingleSelectWidget({
  options,
  onAnswer,
  disabled,
  optional,
}: {
  options: string[]
  onAnswer: (v: string) => void
  disabled?: boolean
  optional?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onAnswer(opt)}
          disabled={disabled}
          className="flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
          {opt}
        </button>
      ))}
    </div>
  )
}

function MultiSelectWidget({
  options,
  onAnswer,
  disabled,
  optional,
}: {
  options: string[]
  onAnswer: (v: string) => void
  disabled?: boolean
  optional?: boolean
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleConfirm = () => {
    const values = [...selected].sort((a, b) => a - b).map((i) => options[i])
    onAnswer(values.join(", "))
    setSelected(new Set())
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => {
          const isSelected = selected.has(i)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(i)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {isSelected ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
              )}
              {opt}
            </button>
          )
        })}
      </div>
      {selected.size > 0 && (
        <Button size="sm" type="button" onClick={handleConfirm} disabled={disabled}>
          Confirm {selected.size} selection{selected.size > 1 ? "s" : ""}
        </Button>
      )}
      {optional && selected.size === 0 && (
        <Button size="sm" type="button" variant="outline" onClick={() => onAnswer("None")} disabled={disabled}>
          None of these apply
        </Button>
      )}
    </div>
  )
}

/** Format up to 8 raw digits as M/D/Y segments: MM, MM/DD, MM/DD/YYYY. */
function formatDateDigits(digits: string): string {
  const d = digits.slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

function DateWidget({
  onAnswer,
  disabled,
  noFuture,
}: {
  onAnswer: (v: string) => void
  disabled?: boolean
  noFuture?: boolean
}) {
  const [display, setDisplay] = useState("")
  const { value: validValue, error } = validateUsDate(display, { allowFuture: !noFuture })
  const digitsEntered = display.replace(/\D/g, "").length

  const commit = () => {
    if (validValue) {
      onAnswer(validValue)
      setDisplay("")
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplay(formatDateDigits(e.target.value.replace(/\D/g, "")))
  }

  // A native date picker never yields a value until all three segments are set,
  // so it's safe to accept its change directly.
  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value // YYYY-MM-DD
    if (!val) return
    const [year, month, day] = val.split("-")
    if (year && month && day) {
      setDisplay(`${month}/${day}/${year}`)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Keep the outer chat form from submitting the raw draft text.
              e.preventDefault()
              e.stopPropagation()
              commit()
            }
          }}
          placeholder="MM/DD/YYYY"
          maxLength={10}
          disabled={disabled}
          className="w-36 rounded-md border bg-background px-3 py-1.5 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <input
          type="date"
          aria-label="Pick a date"
          onChange={handlePickerChange}
          disabled={disabled}
          className="w-fit rounded-md border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button size="sm" type="button" onClick={commit} disabled={disabled || !validValue}>
          Confirm date
        </Button>
      </div>
      {error && digitsEntered >= 8 ? (
        <p className="text-xs text-destructive" role="alert">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Type MM/DD/YYYY, or pick a date, then Confirm.</p>
      )}
    </div>
  )
}

function PhoneWidget({ onAnswer, disabled }: { onAnswer: (v: string) => void; disabled?: boolean }) {
  const [display, setDisplay] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
    const formatted = formatPhoneDigits(digits)
    setDisplay(formatted)
    if (digits.length === 10) {
      onAnswer(formatted)
    }
  }

  return (
    <input
      type="tel"
      value={display}
      onChange={handleChange}
      placeholder="(617) 555-1234"
      disabled={disabled}
      className="w-48 rounded-md border bg-background px-3 py-1.5 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}

function SsnWidget({ onAnswer, disabled }: { onAnswer: (v: string) => void; disabled?: boolean }) {
  const [display, setDisplay] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9)
    const formatted = formatSsnDigits(digits)
    setDisplay(formatted)
    if (digits.length === 9) {
      onAnswer(formatted)
    }
  }

  return (
    <input
      type="text"
      value={display}
      onChange={handleChange}
      placeholder="123-45-6789"
      maxLength={11}
      disabled={disabled}
      className="w-40 rounded-md border bg-background px-3 py-1.5 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}

export function IntakeQuestionWidget({ spec, onAnswer, disabled }: IntakeQuestionWidgetProps) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      {spec.kind === "yes_no" && <YesNoWidget onAnswer={onAnswer} disabled={disabled} />}
      {spec.kind === "single_select" && (
        <SingleSelectWidget options={spec.options} onAnswer={onAnswer} disabled={disabled} />
      )}
      {spec.kind === "multi_select" && (
        <MultiSelectWidget
          options={spec.options}
          onAnswer={onAnswer}
          disabled={disabled}
          optional={spec.optional}
        />
      )}
      {spec.kind === "date" && (
        <DateWidget onAnswer={onAnswer} disabled={disabled} noFuture={spec.noFuture} />
      )}
      {spec.kind === "phone" && <PhoneWidget onAnswer={onAnswer} disabled={disabled} />}
      {spec.kind === "ssn" && <SsnWidget onAnswer={onAnswer} disabled={disabled} />}
    </div>
  )
}
