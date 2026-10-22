/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Saca2Question } from "@/lib/masshealth/saca2/questions/types"

interface Saca2FieldProps {
  id: string
  question: Saca2Question
  label: string
  help?: string
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}

const SELECT_CLASS =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function asString(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value)
}

function parseNumber(raw: string): number | null {
  if (raw.trim() === "") return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function Saca2Field({ id, question, label, help, value, error, onChange }: Saca2FieldProps) {
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined

  const message = (
    <>
      {help ? (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  )

  if (question.kind === "yesNo") {
    return (
      <fieldset className="space-y-2" aria-describedby={describedBy}>
        <legend className="text-sm font-medium">{label}</legend>
        <div className="flex gap-6">
          {(["yes", "no"] as const).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={id}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              {option === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        {message}
      </fieldset>
    )
  }

  if (question.kind === "checkbox") {
    return (
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            id={id}
            type="checkbox"
            className="mt-1"
            checked={value === true}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{label}</span>
        </label>
        {message}
      </div>
    )
  }

  if (question.kind === "select") {
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <select
          id={id}
          className={SELECT_CLASS}
          value={asString(value)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        >
          <option value="">Select…</option>
          {question.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {message}
      </div>
    )
  }

  const isNumeric = question.kind === "money" || question.kind === "number"
  const inputType =
    question.kind === "date" ? "date" : isNumeric ? "number" : question.kind === "email" ? "email" : "text"

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={inputType}
        value={asString(value)}
        {...(isNumeric ? { min: 0, step: question.kind === "money" ? "0.01" : "1", inputMode: "decimal" as const } : {})}
        {...(question.kind === "ssn" ? { inputMode: "numeric" as const, autoComplete: "off", maxLength: 11 } : {})}
        {...(question.kind === "phone" ? { inputMode: "tel" as const, autoComplete: "tel" } : {})}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(isNumeric ? parseNumber(event.target.value) : event.target.value)}
      />
      {message}
    </div>
  )
}
