/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2Answers } from "../types"

export type Saca2QuestionKind =
  | "text"
  | "date"
  | "yesNo"
  | "money"
  | "number"
  | "select"
  | "ssn"
  | "phone"
  | "email"
  | "checkbox"
  | "repeater"

export interface Saca2QuestionContext {
  answers: Saca2Answers
  /** Which person block a person-scope step is rendering (0 = Person 1). Root-scope steps use 0. */
  personIndex: number
  on: Date
  /** Present only for questions inside a repeater item. */
  item?: Record<string, unknown>
}

export type Saca2Text = string | ((ctx: Saca2QuestionContext) => string)

export function resolveText(text: Saca2Text | undefined, ctx: Saca2QuestionContext): string {
  if (text === undefined) return ""
  return typeof text === "function" ? text(ctx) : text
}

export interface Saca2Option {
  value: string
  label: string
}

export interface Saca2RepeaterConfig {
  questions: Saca2Question[]
  emptyItem: () => Record<string, unknown>
  addLabel: string
  itemTitle: string
  maxItems: number
}

export interface Saca2Question {
  /** Unique within a step. Builders set it equal to `path`. */
  id: string
  kind: Saca2QuestionKind
  /**
   * Path relative to the step scope: person scope -> `persons.{personIndex}.{path}`,
   * root scope -> the path as written, inside a repeater -> a key of the item.
   */
  path: string
  label: Saca2Text
  help?: Saca2Text
  options?: readonly Saca2Option[]
  required?: boolean | ((ctx: Saca2QuestionContext) => boolean)
  visibleWhen?: (ctx: Saca2QuestionContext) => boolean
  /** Custom check, run after the built-in kind check for non-empty values. */
  validate?: (value: unknown, ctx: Saca2QuestionContext) => string | null
  repeater?: Saca2RepeaterConfig
}

export interface Saca2Section {
  id: string
  title: Saca2Text
  description?: Saca2Text
  questions: Saca2Question[]
}

export interface Saca2StepContent {
  scope: "root" | "person"
  sections: Saca2Section[]
  /** Cross-field checks that no single question can express. Keys are absolute answer paths. */
  validateStep?: (answers: Saca2Answers, personIndex: number, on: Date) => Record<string, string>
}

export function resolveQuestionPath(scope: "root" | "person", personIndex: number, path: string): string {
  return scope === "person" ? `persons.${personIndex}.${path}` : path
}

export function isQuestionVisible(question: Saca2Question, ctx: Saca2QuestionContext): boolean {
  return question.visibleWhen ? question.visibleWhen(ctx) : true
}

export function isQuestionRequired(question: Saca2Question, ctx: Saca2QuestionContext): boolean {
  return typeof question.required === "function" ? question.required(ctx) : Boolean(question.required)
}
