/**
 * TypeScript interfaces for the Check Application page.
 * @author Bin Lee
 */

export interface WorkflowField {
  path: string
  section: string
  label: string
  hint: string
  value: string
  rawValue: unknown
}

export interface ValidationIssue {
  key: string
  message: string
  step: number | null
}

export interface ValidationSummary {
  total: number
  missing: number
  wizardRuleErrors: number
  valid: boolean
}
