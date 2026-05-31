/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type WidgetSpec =
  | { kind: "yes_no" }
  | { kind: "single_select"; options: string[] }
  | { kind: "multi_select"; options: string[]; optional?: boolean }
  | { kind: "date" }
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

function DateWidget({ onAnswer, disabled }: { onAnswer: (v: string) => void; disabled?: boolean }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value // YYYY-MM-DD
    if (!val) return
    const [year, month, day] = val.split("-")
    if (year && month && day) {
      onAnswer(`${month}/${day}/${year}`)
    }
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Use MM/DD/YYYY, or choose a date.
      <input
        type="date"
        onChange={handleChange}
        disabled={disabled}
        className="w-fit rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
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
      {spec.kind === "date" && <DateWidget onAnswer={onAnswer} disabled={disabled} />}
      {spec.kind === "phone" && <PhoneWidget onAnswer={onAnswer} disabled={disabled} />}
      {spec.kind === "ssn" && <SsnWidget onAnswer={onAnswer} disabled={disabled} />}
    </div>
  )
}
