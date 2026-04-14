/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { DATE_PATTERN, MAX_DOB_AGE_YEARS } from "@/lib/constant"

export interface NameDobEntry {
  name: string
  dob: string
}

export function parseDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) {
    return null
  }

  const [mm, dd, yyyy] = value.split("/").map((part) => Number.parseInt(part, 10))
  const date = new Date(yyyy, mm - 1, dd)

  if (date.getMonth() !== mm - 1 || date.getDate() !== dd || date.getFullYear() !== yyyy) {
    return null
  }

  return date
}

export function formatUsDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = String(date.getFullYear())
  return `${month}/${day}/${year}`
}

export function validateDobBounds(date: Date): string | null {
  const now = new Date()
  if (date.getTime() > now.getTime()) {
    return "Date of birth cannot be in the future."
  }

  const oldestAllowed = new Date(now)
  oldestAllowed.setFullYear(oldestAllowed.getFullYear() - MAX_DOB_AGE_YEARS)

  if (date.getTime() < oldestAllowed.getTime()) {
    return `Date of birth looks too old (more than ${MAX_DOB_AGE_YEARS} years ago).`
  }

  return null
}

export function isFilled(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0
  }

  return false
}

export function normalizeDateInput(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function splitSpouseNameDobValue(value: string): NameDobEntry {
  const normalized = value.trim()
  if (!normalized) {
    return { name: "", dob: "" }
  }

  const byPipe = normalized.split("|").map((part) => part.trim())
  if (byPipe.length === 2 && DATE_PATTERN.test(byPipe[1])) {
    return {
      name: byPipe[0],
      dob: byPipe[1],
    }
  }

  const byComma = normalized.match(/^(.*?),\s*(\d{2}\/\d{2}\/\d{4})$/)
  if (byComma) {
    return {
      name: byComma[1].trim(),
      dob: byComma[2],
    }
  }

  return {
    name: normalized,
    dob: "",
  }
}

export function parseDependentsListValue(value: string): NameDobEntry[] {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line) => {
    const pipeParts = line.split("|").map((part) => part.trim())
    if (pipeParts.length === 2 && DATE_PATTERN.test(pipeParts[1])) {
      return {
        name: pipeParts[0],
        dob: pipeParts[1],
      }
    }

    const commaParts = line.match(/^(.*?),\s*(\d{2}\/\d{2}\/\d{4})$/)
    if (commaParts) {
      return {
        name: commaParts[1].trim(),
        dob: commaParts[2],
      }
    }

    return {
      name: line,
      dob: "",
    }
  })
}

export function buildDependentsListValue(rows: NameDobEntry[]): string {
  return rows
    .map((row) => {
      const name = row.name.trim()
      const dob = row.dob.trim()
      if (!name && !dob) {
        return ""
      }
      if (name && dob) {
        return `${name} | ${dob}`
      }
      return name || dob
    })
    .filter(Boolean)
    .join("\n")
}

export function normalizeNumberInput(input: string): string {
  return input.replace(/[^0-9.]/g, "")
}

export function getExclusiveCheckboxOptions(options: string[]): Set<string> {
  const exclusiveOptions = options.filter((option) => {
    const normalized = option.trim().toLowerCase()
    return normalized === "don't know" || normalized === "choose not to answer"
  })

  return new Set(exclusiveOptions)
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.trim().replace(/\s+/g, " ")
  if (!normalized) {
    return { firstName: "Applicant", lastName: "Unknown" }
  }

  const parts = normalized.split(" ")
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Unknown",
    }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

export function toMonthlyIncome(amount: number, frequency: string): number {
  const normalized = frequency.trim().toLowerCase()
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0
  }

  if (normalized === "weekly") {
    return amount * 4
  }

  if (normalized === "every 2 weeks" || normalized === "biweekly") {
    return amount * 2
  }

  if (normalized === "twice a month") {
    return amount * 2
  }

  if (normalized === "quarterly") {
    return amount / 3
  }

  if (normalized === "yearly") {
    return amount / 12
  }

  return amount
}

export function toAnnualAmount(amount: number, frequency: string): number {
  const normalized = frequency.trim().toLowerCase()
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0
  }

  if (normalized === "weekly") {
    return amount * 52
  }

  if (
    normalized === "every 2 weeks" ||
    normalized === "biweekly" ||
    normalized === "every two weeks"
  ) {
    return amount * 26
  }

  if (normalized === "twice a month") {
    return amount * 24
  }

  if (normalized === "monthly") {
    return amount * 12
  }

  if (normalized === "quarterly") {
    return amount * 4
  }

  if (normalized === "yearly") {
    return amount
  }

  if (normalized === "one time only") {
    return amount
  }

  return amount * 12
}

export function toBooleanYesNo(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "yes"
}

export function countDependentsFromRows(value: unknown): number {
  if (Array.isArray(value)) {
    return value.filter((row) => {
      if (!row || typeof row !== "object") {
        return false
      }
      const asRecord = row as Record<string, unknown>
      return String(asRecord.name ?? "").trim().length > 0
    }).length
  }

  if (typeof value === "string") {
    return parseDependentsListValue(value).filter((row) => row.name.trim().length > 0).length
  }

  return 0
}

export function computeAgeFromDob(value: string): number {
  const date = parseDate(value)
  if (!date) {
    return 0
  }

  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDiff = now.getMonth() - date.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1
  }

  return Math.max(0, age)
}
