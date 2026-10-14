/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { getAtPath } from "../answer-paths"
import {
  isQuestionRequired,
  isQuestionVisible,
  resolveQuestionPath,
  type Saca2Question,
  type Saca2QuestionContext,
  type Saca2QuestionKind,
} from "./types"

const REQUIRED_MESSAGE = "This question is required."

export function isEmptyValue(kind: Saca2QuestionKind, value: unknown): boolean {
  if (kind === "checkbox") return value !== true
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

function isRealIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

export function validateValue(
  question: Saca2Question,
  value: unknown,
  ctx: Saca2QuestionContext,
): string | null {
  if (isEmptyValue(question.kind, value)) {
    return isQuestionRequired(question, ctx) ? REQUIRED_MESSAGE : null
  }

  switch (question.kind) {
    case "ssn":
      if (String(value).replace(/\D/g, "").length !== 9) return "Enter a 9-digit Social Security number."
      break
    case "phone":
      if (String(value).replace(/\D/g, "").length !== 10) return "Enter a 10-digit phone number."
      break
    case "email":
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return "Enter a valid email address."
      break
    case "date":
      if (typeof value !== "string" || !isRealIsoDate(value)) return "Enter a valid date."
      break
    case "money":
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return "Enter a number that is 0 or more."
      }
      break
    case "select":
      if (!question.options?.some((option) => option.value === value)) return "Choose one of the listed options."
      break
    case "yesNo":
      if (value !== "yes" && value !== "no") return "Choose Yes or No."
      break
    default:
      break
  }

  return question.validate?.(value, ctx) ?? null
}

/** Validate visible questions; returned keys are absolute answer paths. */
export function validateQuestions(
  questions: Saca2Question[],
  ctx: Saca2QuestionContext,
  scope: "root" | "person",
  personIndex: number,
  basePath?: string,
  out: Record<string, string> = {},
): Record<string, string> {
  for (const question of questions) {
    if (!isQuestionVisible(question, ctx)) continue

    const absolutePath =
      basePath !== undefined ? `${basePath}.${question.path}` : resolveQuestionPath(scope, personIndex, question.path)
    const value = basePath !== undefined && ctx.item ? ctx.item[question.path] : getAtPath(ctx.answers, absolutePath)

    if (question.kind === "repeater" && question.repeater) {
      const items = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
      if (items.length === 0) {
        if (isQuestionRequired(question, ctx)) out[absolutePath] = "Add at least one."
        continue
      }
      items.forEach((item, index) => {
        validateQuestions(
          question.repeater!.questions,
          { ...ctx, item },
          scope,
          personIndex,
          `${absolutePath}.${index}`,
          out,
        )
      })
      continue
    }

    const message = validateValue(question, value, ctx)
    if (message) out[absolutePath] = message
  }
  return out
}
