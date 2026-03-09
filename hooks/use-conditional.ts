"use client"

import { useMemo } from "react"

export type ConditionalOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "truthy"
  | "falsy"
  | "includes"

export interface ConditionalRule {
  field: string
  op: ConditionalOperator
  value?: unknown
}

export interface ConditionalField {
  show_if?: ConditionalRule
  required?: boolean
  required_if?: ConditionalRule | boolean
}

function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === "string") {
    return value.trim().length > 0
  }

  return Boolean(value)
}

export function evaluateConditionalRule(
  rule: ConditionalRule | undefined,
  formState: Record<string, unknown>,
): boolean {
  if (!rule) {
    return true
  }

  const current = formState[rule.field]

  switch (rule.op) {
    case "eq":
      return current === rule.value
    case "neq":
      return current !== rule.value
    case "in":
      return Array.isArray(rule.value) ? rule.value.includes(current) : false
    case "not_in":
      return Array.isArray(rule.value) ? !rule.value.includes(current) : true
    case "truthy":
      return isTruthy(current)
    case "falsy":
      return !isTruthy(current)
    case "includes":
      return Array.isArray(current) ? current.includes(rule.value) : false
    default:
      return true
  }
}

export function useConditional(field: ConditionalField, formState: Record<string, unknown>) {
  return useMemo(() => {
    const isVisible = evaluateConditionalRule(field.show_if, formState)
    let requiredByRule = false
    if (typeof field.required_if === "boolean") {
      requiredByRule = field.required_if
    } else if (field.required_if) {
      requiredByRule = evaluateConditionalRule(field.required_if, formState)
    }
    const isRequired = Boolean(field.required) || requiredByRule

    return {
      isVisible,
      isRequired,
    }
  }, [field, formState])
}
