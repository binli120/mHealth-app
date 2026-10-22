/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type {
  Saca2Option,
  Saca2Question,
  Saca2QuestionKind,
  Saca2RepeaterConfig,
  Saca2Text,
} from "./types"

type Extra = Partial<Omit<Saca2Question, "id" | "kind" | "path" | "label" | "options" | "repeater">>

function make(kind: Saca2QuestionKind, path: string, label: Saca2Text, extra: Extra = {}): Saca2Question {
  return { id: path, kind, path, label, ...extra }
}

export const text = (path: string, label: Saca2Text, extra?: Extra) => make("text", path, label, extra)
export const date = (path: string, label: Saca2Text, extra?: Extra) => make("date", path, label, extra)
export const yesNo = (path: string, label: Saca2Text, extra?: Extra) => make("yesNo", path, label, extra)
export const money = (path: string, label: Saca2Text, extra?: Extra) => make("money", path, label, extra)
export const number = (path: string, label: Saca2Text, extra?: Extra) => make("number", path, label, extra)
export const ssn = (path: string, label: Saca2Text, extra?: Extra) => make("ssn", path, label, extra)
export const phone = (path: string, label: Saca2Text, extra?: Extra) => make("phone", path, label, extra)
export const email = (path: string, label: Saca2Text, extra?: Extra) => make("email", path, label, extra)
export const checkbox = (path: string, label: Saca2Text, extra?: Extra) => make("checkbox", path, label, extra)

export function select(
  path: string,
  label: Saca2Text,
  options: readonly Saca2Option[],
  extra?: Extra,
): Saca2Question {
  return { ...make("select", path, label, extra), options }
}

export function repeater(
  path: string,
  label: Saca2Text,
  config: Saca2RepeaterConfig,
  extra?: Extra,
): Saca2Question {
  return { ...make("repeater", path, label, extra), repeater: config }
}

export function opts(pairs: ReadonlyArray<readonly [string, string]>): Saca2Option[] {
  return pairs.map(([value, label]) => ({ value, label }))
}
