/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { type FormEvent, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  FileText,
  Loader2,
  Upload,
} from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { validateStepWithWizardRules } from "@/components/application/aca3/form-wizard"
import type { FormRecord, PersonState, WizardData } from "@/components/application/aca3/types"
import {
  runApplicationChecks,
  type ApplicationCheckResult,
  type CheckSeverity,
} from "@/lib/masshealth/application-checks"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  requestExtractWorkflow,
  resetExtractWorkflowState,
  selectExtractWorkflowState,
} from "@/lib/redux/features/extract-workflow-slice"
import { cn } from "@/lib/utils"

interface WorkflowField {
  path: string
  section: string
  label: string
  hint: string
  value: string
  rawValue: unknown
}

interface ValidationIssue {
  key: string
  message: string
  step: number | null
}

interface ValidationSummary {
  total: number
  missing: number
  wizardRuleErrors: number
  valid: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function humanizeToken(token: string): string {
  const normalized = token.replace(/[_-]+/g, " ").trim()
  if (!normalized) {
    return token
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatSegment(segment: string): string {
  if (/^\d+$/.test(segment)) {
    return `Item ${Number(segment) + 1}`
  }

  return humanizeToken(segment)
}

function formatLeafValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  if (typeof value === "number") {
    return String(value)
  }

  if (typeof value === "string") {
    return value
  }

  return ""
}

function buildWorkflowField(segments: string[], value: unknown): WorkflowField {
  const path = segments.length > 0 ? segments.join(".") : "root"
  const firstNamed = segments.find((segment) => !/^\d+$/.test(segment))
  const lastNamed = [...segments].reverse().find((segment) => !/^\d+$/.test(segment))
  const containerSegments = segments.slice(0, -1)

  return {
    path,
    section: firstNamed ? humanizeToken(firstNamed) : "General",
    label: lastNamed ? humanizeToken(lastNamed) : "Value",
    hint:
      containerSegments.length > 0
        ? containerSegments.map((segment) => formatSegment(segment)).join(" / ")
        : "General",
    value: formatLeafValue(value),
    rawValue: value,
  }
}

function flattenWorkflowFields(
  value: unknown,
  segments: string[] = [],
  out: WorkflowField[] = [],
): WorkflowField[] {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push(buildWorkflowField(segments, value))
      return out
    }

    value.forEach((item, index) => {
      flattenWorkflowFields(item, [...segments, String(index)], out)
    })

    return out
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      out.push(buildWorkflowField(segments, value))
      return out
    }

    entries.forEach(([key, item]) => {
      flattenWorkflowFields(item, [...segments, key], out)
    })

    return out
  }

  out.push(buildWorkflowField(segments, value))
  return out
}

function groupFieldsBySection(fields: WorkflowField[]): Array<{ section: string; fields: WorkflowField[] }> {
  const grouped = new Map<string, WorkflowField[]>()

  fields.forEach((field) => {
    const sectionFields = grouped.get(field.section) ?? []
    sectionFields.push(field)
    grouped.set(field.section, sectionFields)
  })

  return Array.from(grouped.entries()).map(([section, groupedFields]) => ({
    section,
    fields: groupedFields,
  }))
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function isArrayIndexSegment(segment: string): boolean {
  return /^\d+$/.test(segment)
}

function setByPath(target: unknown, path: string, value: unknown): void {
  if (!target || typeof target !== "object" || !path || path === "root") {
    return
  }

  const segments = path.split(".")
  let cursor: unknown = target

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const nextSegment = segments[index + 1]

    if (Array.isArray(cursor)) {
      const arrayIndex = Number.parseInt(segment, 10)
      if (!Number.isFinite(arrayIndex) || !cursor[arrayIndex]) {
        cursor[arrayIndex] = isArrayIndexSegment(nextSegment) ? [] : {}
      }
      cursor = cursor[arrayIndex]
      continue
    }

    if (!cursor || typeof cursor !== "object") {
      return
    }

    const record = cursor as Record<string, unknown>
    if (record[segment] === undefined || record[segment] === null) {
      record[segment] = isArrayIndexSegment(nextSegment) ? [] : {}
    }
    cursor = record[segment]
  }

  const lastSegment = segments[segments.length - 1]
  if (Array.isArray(cursor)) {
    const arrayIndex = Number.parseInt(lastSegment, 10)
    if (Number.isFinite(arrayIndex)) {
      cursor[arrayIndex] = value
    }
    return
  }

  if (!cursor || typeof cursor !== "object") {
    return
  }

  ;(cursor as Record<string, unknown>)[lastSegment] = value
}

function parseEditedValue(rawValue: unknown, input: string): unknown {
  if (Array.isArray(rawValue) || (rawValue && typeof rawValue === "object")) {
    return rawValue
  }

  if (typeof rawValue === "boolean") {
    const normalized = input.trim().toLowerCase()
    if (["yes", "true", "1"].includes(normalized)) {
      return true
    }
    if (["no", "false", "0"].includes(normalized)) {
      return false
    }
    return rawValue
  }

  if (typeof rawValue === "number") {
    const parsed = Number.parseFloat(input)
    return Number.isFinite(parsed) ? parsed : rawValue
  }

  if (rawValue === null || rawValue === undefined) {
    return input
  }

  return input
}

function applyFieldValuesToWorkflowData(
  workflowData: Record<string, unknown>,
  fields: WorkflowField[],
  values: Record<string, string>,
): Record<string, unknown> {
  const nextWorkflow = deepClone(workflowData)

  fields.forEach((field) => {
    const edited = values[field.path]
    if (edited === undefined) {
      return
    }

    const parsedValue = parseEditedValue(field.rawValue, edited)
    setByPath(nextWorkflow, field.path, parsedValue)
  })

  return nextWorkflow
}

function asFormRecord(value: unknown): FormRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as FormRecord
}

function mapPersonState(value: unknown): PersonState {
  const source = asFormRecord(value)

  return {
    identity: asFormRecord(source.ss_identity),
    demographics: asFormRecord(source.ss_demographics),
    ssn: asFormRecord(source.ss_ssn),
    tax: asFormRecord(source.ss_tax),
    coverage: asFormRecord(source.ss_coverage),
    income: asFormRecord(source.ss_income),
    skippedOptional: asFormRecord(source.skippedOptional) as Record<string, boolean>,
  }
}

function mapWorkflowToWizardData(workflowData: Record<string, unknown>): WizardData {
  const personsRaw = Array.isArray(workflowData.persons) ? workflowData.persons : []
  const persons = personsRaw.map((person) => mapPersonState(person))
  const contact = asFormRecord(workflowData.step1_contact)
  const resolvedPersonCount = Math.max(persons.length, 1)

  if (!contact.p1_num_people) {
    contact.p1_num_people = String(resolvedPersonCount)
  }

  return {
    preApp: asFormRecord(workflowData.pre_application),
    contact,
    assister: asFormRecord(workflowData.enrollment_assister),
    assisterEnabled: Boolean(workflowData.assisterEnabled),
    persons:
      persons.length > 0
        ? persons
        : [
            {
              identity: {},
              demographics: {},
              ssn: {},
              tax: {},
              coverage: {},
              income: {},
              skippedOptional: {},
            },
          ],
    attestation: Boolean(workflowData.attestation),
  }
}

const CHECK_CATEGORY_LABELS: Record<string, string> = {
  income_consistency: "Income Consistency",
  ssn_coverage: "Social Security Numbers",
  immigration_status: "Immigration Status",
  form_supplements: "Required Supplements",
  age_thresholds: "Age & Program Thresholds",
}

const SEVERITY_STYLES: Record<CheckSeverity, { row: string; badge: string; label: string }> = {
  error: {
    row: "border-destructive/40 bg-destructive/5",
    badge: "bg-destructive/15 text-destructive",
    label: "Error",
  },
  warning: {
    row: "border-warning/40 bg-warning/5",
    badge: "bg-warning/15 text-warning",
    label: "Warning",
  },
  info: {
    row: "border-blue-500/30 bg-blue-500/5",
    badge: "bg-blue-500/15 text-blue-600",
    label: "Info",
  },
}

function ApplicationChecksPanel({ results }: { results: ApplicationCheckResult[] }) {
  const errorCount = results.filter((r) => r.severity === "error").length
  const warnCount = results.filter((r) => r.severity === "warning").length
  const infoCount = results.filter((r) => r.severity === "info").length

  // Group by category for display
  const byCategory = new Map<string, ApplicationCheckResult[]>()
  for (const result of results) {
    const list = byCategory.get(result.category) ?? []
    list.push(result)
    byCategory.set(result.category, list)
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-foreground">Business Rule Checks</p>
        <div className="flex gap-2 text-xs">
          {errorCount > 0 ? (
            <span className="rounded-full px-2 py-0.5 bg-destructive/15 text-destructive font-medium">
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          ) : null}
          {warnCount > 0 ? (
            <span className="rounded-full px-2 py-0.5 bg-warning/15 text-warning font-medium">
              {warnCount} warning{warnCount !== 1 ? "s" : ""}
            </span>
          ) : null}
          {infoCount > 0 ? (
            <span className="rounded-full px-2 py-0.5 bg-blue-500/15 text-blue-600 font-medium">
              {infoCount} note{infoCount !== 1 ? "s" : ""}
            </span>
          ) : null}
          {results.length === 0 ? (
            <span className="rounded-full px-2 py-0.5 bg-success/15 text-success font-medium">
              All checks passed
            </span>
          ) : null}
        </div>
      </div>

      {Array.from(byCategory.entries()).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {CHECK_CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="space-y-2">
            {items.map((result) => {
              const styles = SEVERITY_STYLES[result.severity]
              return (
                <div
                  key={result.id}
                  className={cn("rounded-lg border px-3 py-2.5 text-sm", styles.row)}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                        styles.badge,
                      )}
                    >
                      {styles.label}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{result.title}</p>
                      <p className="mt-0.5 text-muted-foreground">{result.message}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function inferStepFromErrorKey(errorKey: string): number | null {
  const match = /^step(\d+)\./.exec(errorKey)
  if (!match) {
    return null
  }

  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

export default function CheckApplicationPage() {
  const dispatch = useAppDispatch()
  const extractState = useAppSelector(selectExtractWorkflowState)
  const [file, setFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isUploaderExpanded, setIsUploaderExpanded] = useState(() => !Boolean(extractState.data))
  const [isEditing, setIsEditing] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null)
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [appCheckResults, setAppCheckResults] = useState<ApplicationCheckResult[]>([])

  const data = extractState.data
  const isSubmitting = extractState.status === "loading"
  const requestError = extractState.error

  const workflowFields = useMemo(() => {
    if (!data?.workflow_data) {
      return []
    }

    return flattenWorkflowFields(data.workflow_data)
  }, [data])

  const groupedWorkflowFields = useMemo(() => groupFieldsBySection(workflowFields), [workflowFields])

  const workflowStats = useMemo(() => {
    if (workflowFields.length === 0) {
      return null
    }

    const filled = workflowFields.reduce((count, field) => {
      const value = (fieldValues[field.path] ?? field.value).trim()
      return count + (value.length > 0 ? 1 : 0)
    }, 0)

    const total = workflowFields.length
    const confidence = total === 0 ? 0 : Math.round((filled / total) * 100)

    return {
      total,
      filled,
      confidence,
      missing: Math.max(total - filled, 0),
    }
  }, [fieldValues, workflowFields])

  const warnings = useMemo(() => {
    const extractedWarnings = data?.extraction?.warnings
    return Array.isArray(extractedWarnings)
      ? extractedWarnings.filter((item): item is string => typeof item === "string")
      : []
  }, [data])

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)

    if (!file) {
      setLocalError("Please choose a PDF file first.")
      return
    }

    setValidationSummary(null)
    setValidationIssues([])
    setAppCheckResults([])
    const extracted = await dispatch(requestExtractWorkflow({ file }))
    if (!extracted?.workflow_data) {
      return
    }

    const extractedFields = flattenWorkflowFields(extracted.workflow_data)
    const nextValues = extractedFields.reduce<Record<string, string>>((acc, field) => {
      acc[field.path] = field.value
      return acc
    }, {})

    setFieldValues(nextValues)
    setIsEditing(false)
    setIsUploaderExpanded(false)
  }

  const handleValidate = () => {
    if (workflowFields.length === 0 || !data?.workflow_data || typeof data.workflow_data !== "object") {
      setValidationSummary(null)
      setValidationIssues([])
      return
    }

    const workflowData = applyFieldValuesToWorkflowData(
      data.workflow_data as Record<string, unknown>,
      workflowFields,
      fieldValues,
    )
    const wizardData = mapWorkflowToWizardData(workflowData)

    const wizardRuleErrors: Record<string, string> = {}
    for (const step of [2, 3, 4, 5, 6, 7]) {
      Object.assign(wizardRuleErrors, validateStepWithWizardRules(step, wizardData))
    }

    const missing = workflowFields.reduce((count, field) => {
      const value = (fieldValues[field.path] ?? field.value).trim()
      return count + (value.length === 0 ? 1 : 0)
    }, 0)

    const issues = Object.entries(wizardRuleErrors).map(([key, message]) => ({
      key,
      message,
      step: inferStepFromErrorKey(key),
    }))
    issues.sort((a, b) => {
      const aStep = a.step ?? Number.MAX_SAFE_INTEGER
      const bStep = b.step ?? Number.MAX_SAFE_INTEGER
      if (aStep !== bStep) {
        return aStep - bStep
      }
      return a.key.localeCompare(b.key)
    })

    setValidationIssues(issues)
    setValidationSummary({
      total: workflowFields.length,
      missing,
      wizardRuleErrors: issues.length,
      valid: issues.length === 0,
    })

    const checkResults = runApplicationChecks({
      contact: wizardData.contact,
      persons: wizardData.persons,
      detectedFormVariant: data?.detected_form_variant,
    })
    setAppCheckResults(checkResults)
  }

  const openUploader = () => {
    setIsUploaderExpanded(true)
    setLocalError(null)
    setIsEditing(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">HealthCompass MA</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Check Your Application</h1>
          <p className="text-muted-foreground">
            Upload a completed application PDF and we will extract and verify the form details for you.
          </p>
        </div>

        {isUploaderExpanded ? (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Upload Application PDF</CardTitle>
              <CardDescription>PDF only. The file is processed with OCR verification.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => void handleUpload(event)}>
                <label
                  htmlFor="application-pdf"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 font-medium text-foreground">
                    {file ? file.name : "Click to choose a PDF file"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {file ? formatFileSize(file.size) : "Drag and drop or browse"}
                  </p>
                </label>
                <input
                  id="application-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null
                    setLocalError(null)
                    setValidationSummary(null)
                    setValidationIssues([])
                    setAppCheckResults([])
                    setFile(nextFile)
                    setFieldValues({})
                    dispatch(resetExtractWorkflowState())
                  }}
                />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || !file}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extracting data...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Upload and Extract
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setLocalError(null)
                      setValidationSummary(null)
                      setValidationIssues([])
                      setAppCheckResults([])
                      setFile(null)
                      setFieldValues({})
                      dispatch(resetExtractWorkflowState())
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{file?.name ?? data?.source_pdf ?? "Uploaded PDF"}</p>
                  <p className="text-sm text-muted-foreground">
                    Upload another file anytime to run a new extraction.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={openUploader}>
                Upload Another File
              </Button>
            </CardContent>
          </Card>
        )}

        {isSubmitting ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 p-4 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <div>
                <p className="text-sm font-medium">Extracting data...</p>
                <p className="text-xs text-primary/80">Please wait while we verify your application form.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {localError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{localError}</span>
            </CardContent>
          </Card>
        ) : null}

        {requestError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{requestError}</span>
            </CardContent>
          </Card>
        ) : null}

        {data ? (
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Extracted Application Form
                  </CardTitle>
                  <CardDescription>
                    Source: {data.source_pdf} | Variant: {data.detected_form_variant ?? "Unknown"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={isEditing ? "default" : "outline"}
                    className="gap-2"
                    onClick={() => {
                      setIsEditing((current) => !current)
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                    {isEditing ? "Save" : "Edit"}
                  </Button>
                  <Button type="button" className="gap-2" onClick={handleValidate}>
                    <CheckCircle2 className="h-4 w-4" />
                    Validate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {workflowStats ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Workflow completeness</span>
                      <span className="font-medium text-foreground">{workflowStats.confidence}%</span>
                    </div>
                    <Progress value={workflowStats.confidence} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Filled Fields</p>
                      <p className="text-xl font-semibold text-foreground">{workflowStats.filled}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Missing Fields</p>
                      <p className="text-xl font-semibold text-foreground">{workflowStats.missing}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Total Fields</p>
                      <p className="text-xl font-semibold text-foreground">{workflowStats.total}</p>
                    </div>
                  </div>
                </>
              ) : null}

              {validationSummary ? (
                <div
                  className={cn(
                    "rounded-lg border p-4 text-sm",
                    validationSummary.valid
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/10 text-warning",
                  )}
                >
                  {validationSummary.valid
                    ? `Validation passed with wizard rules. ${validationSummary.total} fields checked.`
                    : `Validation found ${validationSummary.wizardRuleErrors} wizard rule issue(s).`}
                </div>
              ) : null}

              {validationSummary && !validationSummary.valid && validationIssues.length > 0 ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <p className="text-sm font-medium text-foreground">Wizard validation issues</p>
                  <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-auto pl-5 text-sm text-muted-foreground">
                    {validationIssues.map((issue) => (
                      <li key={issue.key}>
                        {issue.step ? `Step ${issue.step}: ` : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {appCheckResults.length > 0 ? (
                <ApplicationChecksPanel results={appCheckResults} />
              ) : null}

              {warnings.length > 0 ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <p className="text-sm font-medium text-foreground">Extraction warnings</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-5">
                {groupedWorkflowFields.map(({ section, fields }) => (
                  <section key={section} className="space-y-3 rounded-lg border border-border p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section}</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {fields.map((field) => {
                        const value = fieldValues[field.path] ?? field.value
                        const isMissing = validationSummary ? value.trim().length === 0 : false
                        const useTextarea = value.length > 100 || value.includes("\n")

                        return (
                          <div
                            key={field.path}
                            className={cn(
                              "rounded-lg border p-3",
                              isMissing
                                ? "border-warning/50 bg-warning/5"
                                : "border-border bg-secondary/30",
                            )}
                          >
                            <p className="text-xs font-medium text-foreground">{field.label}</p>
                            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">{field.hint}</p>
                            {useTextarea ? (
                              <Textarea
                                value={value}
                                rows={3}
                                disabled={!isEditing}
                                onChange={(event) => {
                                  const nextValue = event.target.value
                                  setFieldValues((current) => ({
                                    ...current,
                                    [field.path]: nextValue,
                                  }))
                                }}
                              />
                            ) : (
                              <Input
                                value={value}
                                disabled={!isEditing}
                                onChange={(event) => {
                                  const nextValue = event.target.value
                                  setFieldValues((current) => ({
                                    ...current,
                                    [field.path]: nextValue,
                                  }))
                                }}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  )
}
